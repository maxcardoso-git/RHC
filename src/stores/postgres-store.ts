import pg from 'pg';
import {
  HealthStatus,
  ResourceDescriptor,
  ResourceHealthCheck,
  ResourceHealthStatus
} from '../domain/types.js';
import { logger } from '../utils/logger.js';
import { IHealthStore } from './store-interface.js';

const { Pool } = pg;

export class PostgresStore implements IHealthStore {
  private pool: pg.Pool;

  // In-memory cache for faster reads
  private resourceCache = new Map<string, ResourceDescriptor>();
  private statusCache = new Map<string, ResourceHealthStatus>();
  private cacheEnabled: boolean;

  constructor(connectionString: string, enableCache = true) {
    this.pool = new Pool({
      connectionString,
      max: 20, // Maximum pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.cacheEnabled = enableCache;

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
    });

    logger.info({ enableCache }, 'PostgresStore initialized');
  }

  // ========================================
  // LIFECYCLE
  // ========================================

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('PostgreSQL connection pool established');
    } catch (err) {
      logger.error({ err }, 'Failed to connect to PostgreSQL');
      throw err;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.resourceCache.clear();
    this.statusCache.clear();
    logger.info('PostgreSQL connection pool closed');
  }

  // ========================================
  // RESOURCES (Catalog)
  // ========================================

  async setResources(resources: ResourceDescriptor[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const res of resources) {
        await client.query(
          `INSERT INTO resources (id, name, type, subtype, enabled, owner, env, criticality, tags, connection, config, policy, source, synced_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             type = EXCLUDED.type,
             subtype = EXCLUDED.subtype,
             enabled = EXCLUDED.enabled,
             owner = EXCLUDED.owner,
             env = EXCLUDED.env,
             criticality = EXCLUDED.criticality,
             tags = EXCLUDED.tags,
             connection = EXCLUDED.connection,
             config = EXCLUDED.config,
             policy = EXCLUDED.policy,
             source = EXCLUDED.source,
             synced_at = EXCLUDED.synced_at,
             updated_at = NOW()`,
          [
            res.id,
            res.name,
            res.type,
            res.subtype,
            res.enabled,
            res.owner,
            res.env,
            res.criticality,
            res.tags || [],
            JSON.stringify(res.connection || {}),
            JSON.stringify(res.config || {}),
            JSON.stringify(res.policy || {}),
            (res as any).source || 'manual',
            (res as any).synced_at || null
          ]
        );
      }

      await client.query('COMMIT');

      // Update cache
      if (this.cacheEnabled) {
        this.resourceCache.clear();
        resources.forEach((res) => this.resourceCache.set(res.id, res));
      }
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error({ err }, 'Failed to set resources');
      throw err;
    } finally {
      client.release();
    }
  }

  async listResources(): Promise<ResourceDescriptor[]> {
    try {
      const result = await this.pool.query(
        `SELECT id, name, type, subtype, enabled, owner, env, criticality, tags,
                connection, config, policy, source, synced_at, created_at, updated_at
         FROM resources
         ORDER BY name ASC`
      );

      const resources = result.rows.map(this.mapRowToResource);

      // Update cache
      if (this.cacheEnabled) {
        this.resourceCache.clear();
        resources.forEach((res) => this.resourceCache.set(res.id, res));
      }

      return resources;
    } catch (err) {
      logger.error({ err }, 'Failed to list resources');
      throw err;
    }
  }

  async upsertResource(resource: ResourceDescriptor): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO resources (id, name, type, subtype, enabled, owner, env, criticality, tags, connection, config, policy, source, synced_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           type = EXCLUDED.type,
           subtype = EXCLUDED.subtype,
           enabled = EXCLUDED.enabled,
           owner = EXCLUDED.owner,
           env = EXCLUDED.env,
           criticality = EXCLUDED.criticality,
           tags = EXCLUDED.tags,
           connection = EXCLUDED.connection,
           config = EXCLUDED.config,
           policy = EXCLUDED.policy,
           source = EXCLUDED.source,
           synced_at = EXCLUDED.synced_at,
           updated_at = NOW()`,
        [
          resource.id,
          resource.name,
          resource.type,
          resource.subtype,
          resource.enabled,
          resource.owner,
          resource.env,
          resource.criticality,
          resource.tags || [],
          JSON.stringify(resource.connection || {}),
          JSON.stringify(resource.config || {}),
          JSON.stringify(resource.policy || {}),
          (resource as any).source || 'manual',
          (resource as any).synced_at || null
        ]
      );

      // Update cache
      if (this.cacheEnabled) {
        this.resourceCache.set(resource.id, resource);
      }
    } catch (err) {
      logger.error({ err, resourceId: resource.id }, 'Failed to upsert resource');
      throw err;
    }
  }

  async getResource(id: string): Promise<ResourceDescriptor | undefined> {
    // Check cache first
    if (this.cacheEnabled && this.resourceCache.has(id)) {
      return this.resourceCache.get(id);
    }

    try {
      const result = await this.pool.query(
        `SELECT id, name, type, subtype, enabled, owner, env, criticality, tags,
                connection, config, policy, source, synced_at, created_at, updated_at
         FROM resources
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return undefined;
      }

      const resource = this.mapRowToResource(result.rows[0]);

      // Update cache
      if (this.cacheEnabled) {
        this.resourceCache.set(id, resource);
      }

      return resource;
    } catch (err) {
      logger.error({ err, resourceId: id }, 'Failed to get resource');
      throw err;
    }
  }

  async removeResource(resourceId: string): Promise<void> {
    try {
      await this.pool.query('DELETE FROM resources WHERE id = $1', [resourceId]);

      // Clear from cache
      if (this.cacheEnabled) {
        this.resourceCache.delete(resourceId);
        this.statusCache.delete(resourceId);
      }
    } catch (err) {
      logger.error({ err, resourceId }, 'Failed to remove resource');
      throw err;
    }
  }

  // ========================================
  // HEALTH STATUS
  // ========================================

  async upsertStatus(status: ResourceHealthStatus): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO health_status (resource_id, resource_name, resource_type, resource_subtype, env, current_status, last_check_at, last_success_at, consecutive_failures, summary, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (resource_id) DO UPDATE SET
           resource_name = EXCLUDED.resource_name,
           resource_type = EXCLUDED.resource_type,
           resource_subtype = EXCLUDED.resource_subtype,
           env = EXCLUDED.env,
           current_status = EXCLUDED.current_status,
           last_check_at = EXCLUDED.last_check_at,
           last_success_at = EXCLUDED.last_success_at,
           consecutive_failures = EXCLUDED.consecutive_failures,
           summary = EXCLUDED.summary,
           updated_at = NOW()`,
        [
          status.resource_id,
          status.resource_name,
          status.resource_type,
          status.resource_subtype,
          status.env,
          status.current_status,
          status.last_check_at,
          status.last_success_at,
          status.consecutive_failures,
          JSON.stringify(status.summary || {})
        ]
      );

      // Update cache
      if (this.cacheEnabled) {
        this.statusCache.set(status.resource_id, {
          ...status,
          updated_at: new Date().toISOString()
        });
      }
    } catch (err) {
      logger.error({ err, resourceId: status.resource_id }, 'Failed to upsert status');
      throw err;
    }
  }

  async getStatus(resourceId: string): Promise<ResourceHealthStatus | undefined> {
    // Check cache first
    if (this.cacheEnabled && this.statusCache.has(resourceId)) {
      return this.statusCache.get(resourceId);
    }

    try {
      const result = await this.pool.query(
        `SELECT resource_id, resource_name, resource_type, resource_subtype, env,
                current_status, last_check_at, last_success_at, consecutive_failures,
                summary, created_at, updated_at
         FROM health_status
         WHERE resource_id = $1`,
        [resourceId]
      );

      if (result.rows.length === 0) {
        return undefined;
      }

      const status = this.mapRowToStatus(result.rows[0]);

      // Update cache
      if (this.cacheEnabled) {
        this.statusCache.set(resourceId, status);
      }

      return status;
    } catch (err) {
      logger.error({ err, resourceId }, 'Failed to get status');
      throw err;
    }
  }

  async listStatus(filters?: {
    type?: string;
    subtype?: string;
    status?: HealthStatus;
    tag?: string;
    owner?: string;
    env?: string;
  }): Promise<ResourceHealthStatus[]> {
    try {
      let query = `
        SELECT hs.resource_id, hs.resource_name, hs.resource_type, hs.resource_subtype, hs.env,
               hs.current_status, hs.last_check_at, hs.last_success_at, hs.consecutive_failures,
               hs.summary, hs.created_at, hs.updated_at
        FROM health_status hs
      `;

      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters?.type) {
        conditions.push(`hs.resource_type = $${paramIndex++}`);
        values.push(filters.type);
      }

      if (filters?.subtype) {
        conditions.push(`hs.resource_subtype = $${paramIndex++}`);
        values.push(filters.subtype);
      }

      if (filters?.status) {
        conditions.push(`hs.current_status = $${paramIndex++}`);
        values.push(filters.status);
      }

      if (filters?.env) {
        conditions.push(`hs.env = $${paramIndex++}`);
        values.push(filters.env);
      }

      // For tag and owner, we need to join with resources table
      if (filters?.tag || filters?.owner) {
        query += ` INNER JOIN resources r ON hs.resource_id = r.id`;

        if (filters?.tag) {
          conditions.push(`$${paramIndex} = ANY(r.tags)`);
          values.push(filters.tag);
          paramIndex++;
        }

        if (filters?.owner) {
          conditions.push(`r.owner = $${paramIndex++}`);
          values.push(filters.owner);
        }
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ` ORDER BY hs.last_check_at DESC`;

      const result = await this.pool.query(query, values);
      return result.rows.map(this.mapRowToStatus);
    } catch (err) {
      logger.error({ err, filters }, 'Failed to list status');
      throw err;
    }
  }

  async incrementFailures(resourceId: string): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE health_status
         SET consecutive_failures = consecutive_failures + 1,
             updated_at = NOW()
         WHERE resource_id = $1`,
        [resourceId]
      );

      // Invalidate cache
      if (this.cacheEnabled) {
        this.statusCache.delete(resourceId);
      }
    } catch (err) {
      logger.error({ err, resourceId }, 'Failed to increment failures');
      throw err;
    }
  }

  async resetFailures(resourceId: string): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE health_status
         SET consecutive_failures = 0,
             updated_at = NOW()
         WHERE resource_id = $1`,
        [resourceId]
      );

      // Invalidate cache
      if (this.cacheEnabled) {
        this.statusCache.delete(resourceId);
      }
    } catch (err) {
      logger.error({ err, resourceId }, 'Failed to reset failures');
      throw err;
    }
  }

  // ========================================
  // HEALTH CHECKS (History)
  // ========================================

  async addCheck(check: ResourceHealthCheck): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO health_checks (id, resource_id, executed_at, execution_type, final_status, duration_ms, metrics, rule_evaluations, error_message, collector_debug)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          check.id,
          check.resource_id,
          check.executed_at,
          check.execution_type,
          check.final_status,
          check.duration_ms,
          JSON.stringify(check.metrics || {}),
          JSON.stringify(check.rule_evaluations || {}),
          check.error_message || null,
          JSON.stringify(check.collector_debug || {})
        ]
      );
    } catch (err) {
      logger.error({ err, checkId: check.id }, 'Failed to add check');
      throw err;
    }
  }

  async listChecks(resourceId: string, limit = 20, offset = 0): Promise<{ items: ResourceHealthCheck[]; total: number }> {
    try {
      // Get total count
      const countResult = await this.pool.query(
        'SELECT COUNT(*) as total FROM health_checks WHERE resource_id = $1',
        [resourceId]
      );
      const total = parseInt(countResult.rows[0].total, 10);

      // Get paginated items
      const result = await this.pool.query(
        `SELECT id, resource_id, executed_at, execution_type, final_status, duration_ms,
                metrics, rule_evaluations, error_message, collector_debug, created_at
         FROM health_checks
         WHERE resource_id = $1
         ORDER BY executed_at DESC
         LIMIT $2 OFFSET $3`,
        [resourceId, limit, offset]
      );

      const items = result.rows.map(this.mapRowToCheck);

      return { items, total };
    } catch (err) {
      logger.error({ err, resourceId }, 'Failed to list checks');
      throw err;
    }
  }

  async getCheck(checkId: string): Promise<ResourceHealthCheck | undefined> {
    try {
      const result = await this.pool.query(
        `SELECT id, resource_id, executed_at, execution_type, final_status, duration_ms,
                metrics, rule_evaluations, error_message, collector_debug, created_at
         FROM health_checks
         WHERE id = $1`,
        [checkId]
      );

      if (result.rows.length === 0) {
        return undefined;
      }

      return this.mapRowToCheck(result.rows[0]);
    } catch (err) {
      logger.error({ err, checkId }, 'Failed to get check');
      throw err;
    }
  }

  // ========================================
  // MAINTENANCE
  // ========================================

  async cleanupOldChecks(): Promise<number> {
    try {
      const result = await this.pool.query('SELECT cleanup_old_health_checks() as deleted');
      const deleted = result.rows[0]?.deleted || 0;
      logger.info({ deleted }, 'Cleaned up old health checks');
      return deleted;
    } catch (err) {
      logger.error({ err }, 'Failed to cleanup old checks');
      throw err;
    }
  }

  async invalidateCache(): Promise<void> {
    this.resourceCache.clear();
    this.statusCache.clear();
    logger.info('Cache invalidated');
  }

  // ========================================
  // PRIVATE MAPPERS
  // ========================================

  private mapRowToResource(row: any): ResourceDescriptor {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      subtype: row.subtype,
      enabled: row.enabled,
      owner: row.owner,
      env: row.env,
      criticality: row.criticality,
      tags: row.tags || [],
      connection: row.connection || {},
      config: row.config || {},
      policy: row.policy || {},
      source: row.source,
      synced_at: row.synced_at,
      updated_at: row.updated_at
    } as any;
  }

  private mapRowToStatus(row: any): ResourceHealthStatus {
    return {
      resource_id: row.resource_id,
      resource_name: row.resource_name,
      resource_type: row.resource_type,
      resource_subtype: row.resource_subtype,
      env: row.env,
      current_status: row.current_status,
      last_check_at: row.last_check_at,
      last_success_at: row.last_success_at,
      consecutive_failures: row.consecutive_failures,
      summary: row.summary || {},
      updated_at: row.updated_at
    } as any;
  }

  private mapRowToCheck(row: any): ResourceHealthCheck {
    return {
      id: row.id,
      resource_id: row.resource_id,
      executed_at: row.executed_at,
      execution_type: row.execution_type,
      final_status: row.final_status,
      duration_ms: row.duration_ms,
      metrics: row.metrics || {},
      rule_evaluations: row.rule_evaluations || {},
      error_message: row.error_message,
      collector_debug: row.collector_debug
    };
  }
}
