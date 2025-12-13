import { AppConfig } from '../config/index.js';
import { ResourceDescriptor, HealthPolicy, ResourceType, ResourceSubtype } from '../domain/types.js';
import { logger } from '../utils/logger.js';

type OrchestratorResource = {
  id: string;
  name: string;
  type: string;
  subtype?: string | null;
  endpoint?: string | null;
  env?: string | null;
  isActive?: boolean;
  healthStatus?: string | null;
  healthCheckEnabled?: boolean | null;
  healthCheckSchedule?: string | null;
};

export class ResourceRegistryClient {
  private cache: { items: ResourceDescriptor[]; fetchedAt: number } | null = null;

  constructor(private cfg: AppConfig) {}

  private headers() {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.cfg.resourceRegistry.apiKey) {
      headers['X-API-Key'] = this.cfg.resourceRegistry.apiKey;
    }
    return headers;
  }

  private baseUrl(): string {
    return this.cfg.resourceRegistry.baseUrl.replace(/\/$/, '');
  }

  private mapType(raw: string, subtype?: string | null): ResourceType {
    const upperType = (raw || '').toUpperCase();
    const upperSubtype = (subtype || '').toUpperCase();
    if (upperType === 'DB') return 'database';
    if (upperType === 'CACHE' || upperType === 'QUEUE') return 'cache_queue';
    if (upperType === 'HTTP') {
      if (upperSubtype === 'LLM') return 'llm_provider';
      if (upperSubtype === 'VECTOR_LAYER' || upperSubtype === 'VECTOR_ENGINE') return 'vector_db';
      return 'http_service';
    }
    if (upperType === 'EMBEDDING') return 'llm_provider';
    if (upperType === 'FUNCTION') return 'http_service';
    if (upperType === 'WEBHOOK') return 'http_service';
    return 'http_service';
  }

  private mapSubtype(raw?: string | null): ResourceSubtype | undefined {
    const value = (raw || '').toLowerCase();
    const allowed: ResourceSubtype[] = [
      'postgres',
      'mongo',
      'redis',
      'rabbitmq',
      'kafka',
      'internal_api',
      'external_api',
      'openai',
      'gemini',
      'anthropic',
      'local_vllm',
      'local_tgi',
      'pgvector',
      'pinecone',
      'weaviate',
      'qdrant'
    ];
    return allowed.includes(value as ResourceSubtype) ? (value as ResourceSubtype) : undefined;
  }

  private defaultPolicy(resource: ResourceDescriptor, schedule: string, enabled: boolean): HealthPolicy {
    switch (resource.type) {
      case 'database':
        return {
          policy_id: `hp_${resource.id}`,
          resource_id: resource.id,
          enabled,
          schedule: { type: 'INTERVAL', value: schedule },
          metrics: [{ name: 'connection_ok' }, { name: 'latency_ms' }],
          rules: [
            { rule_id: 'conn', metric: 'connection_ok', operator: '==', threshold: true, onFailStatus: 'DOWN', severity: 'CRITICAL' },
            { rule_id: 'latency', metric: 'latency_ms', operator: '<=', threshold: 1000, onFailStatus: 'DEGRADED', severity: 'HIGH' }
          ],
          aggregation: { strategy: 'worst_of' },
          cooldown: { perResourceMinutes: 30, perRuleMinutes: 15 }
        };
      case 'llm_provider':
        return {
          policy_id: `hp_${resource.id}`,
          resource_id: resource.id,
          enabled,
          schedule: { type: 'INTERVAL', value: schedule },
          metrics: [{ name: 'availability' }, { name: 'response_time_ms' }],
          rules: [
            { rule_id: 'avail', metric: 'availability', operator: '==', threshold: true, onFailStatus: 'DOWN', severity: 'CRITICAL' },
            { rule_id: 'rt', metric: 'response_time_ms', operator: '<=', threshold: 4000, onFailStatus: 'DEGRADED', severity: 'HIGH' }
          ],
          aggregation: { strategy: 'worst_of' },
          cooldown: { perResourceMinutes: 20, perRuleMinutes: 10 }
        };
      case 'vector_db':
        return {
          policy_id: `hp_${resource.id}`,
          resource_id: resource.id,
          enabled,
          schedule: { type: 'INTERVAL', value: schedule },
          metrics: [{ name: 'index_available' }, { name: 'query_latency_ms' }],
          rules: [
            { rule_id: 'idx', metric: 'index_available', operator: '==', threshold: true, onFailStatus: 'DOWN', severity: 'CRITICAL' },
            { rule_id: 'ql', metric: 'query_latency_ms', operator: '<=', threshold: 1000, onFailStatus: 'DEGRADED', severity: 'HIGH' }
          ],
          aggregation: { strategy: 'worst_of' },
          cooldown: { perResourceMinutes: 30, perRuleMinutes: 15 }
        };
      default:
        return {
          policy_id: `hp_${resource.id}`,
          resource_id: resource.id,
          enabled,
          schedule: { type: 'INTERVAL', value: schedule },
          metrics: [{ name: 'status_code' }, { name: 'response_time_ms' }],
          rules: [
            { rule_id: 'status', metric: 'status_code', operator: '==', threshold: 200, onFailStatus: 'DOWN', severity: 'CRITICAL' },
            { rule_id: 'rt', metric: 'response_time_ms', operator: '<=', threshold: 3000, onFailStatus: 'DEGRADED', severity: 'HIGH' }
          ],
          aggregation: { strategy: 'worst_of' },
          cooldown: { perResourceMinutes: 20, perRuleMinutes: 10 }
        };
    }
  }

  private toDescriptor(raw: OrchestratorResource): ResourceDescriptor {
    const type = this.mapType(raw.type, raw.subtype);
    const subtype = this.mapSubtype(raw.subtype);
    const enabled = raw.isActive ?? true;
    const schedule = raw.healthCheckSchedule || 'PT10M';
    const descriptor: ResourceDescriptor = {
      id: raw.id,
      name: raw.name,
      type,
      subtype,
      enabled,
      env: raw.env || undefined,
      tags: [raw.type?.toLowerCase() || '', raw.env?.toLowerCase() || ''].filter(Boolean),
      connection: { endpoint: raw.endpoint },
      policy: undefined
    };
    descriptor.policy = this.defaultPolicy(descriptor, schedule, enabled);
    return descriptor;
  }

  async listResources(force = false): Promise<ResourceDescriptor[]> {
    if (!force && this.cache && Date.now() - this.cache.fetchedAt < this.cfg.resourceRegistry.cacheSeconds * 1000) {
      return this.cache.items;
    }
    const url = `${this.baseUrl()}/recursos?ativo=true`;
    try {
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) {
        throw new Error(`registry response ${res.status}`);
      }
      const payload = (await res.json()) as { success?: boolean; data?: OrchestratorResource[] };
      const data = payload.data || [];
      const mapped = data.map((item) => this.toDescriptor(item));
      this.cache = { items: mapped, fetchedAt: Date.now() };
      return mapped;
    } catch (err) {
      logger.error({ err, url }, 'failed to list resources from registry');
      return this.cache?.items || [];
    }
  }

  async getResource(resourceId: string): Promise<ResourceDescriptor | undefined> {
    const list = await this.listResources();
    const found = list.find((r) => r.id === resourceId);
    if (found) return found;
    try {
      const url = `${this.baseUrl()}/recursos/${resourceId}`;
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) return undefined;
      const payload = (await res.json()) as { success?: boolean; data?: OrchestratorResource };
      const item = payload.data;
      if (!item) return undefined;
      return this.toDescriptor(item);
    } catch (err) {
      logger.error({ err, resourceId }, 'failed to fetch resource directly');
      return undefined;
    }
  }
}
