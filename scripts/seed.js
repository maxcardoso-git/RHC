#!/usr/bin/env node

/**
 * Database seed script - Populates database with sample data for development
 * Usage:
 *   node scripts/seed.js
 */

import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is required');
  console.error('Example: DATABASE_URL=postgresql://user:password@localhost:5432/rhc_db');
  process.exit(1);
}

const sampleResources = [
  {
    id: 'prod-postgres-main',
    name: 'Production PostgreSQL',
    type: 'database',
    subtype: 'postgres',
    enabled: true,
    owner: 'platform-team',
    env: 'production',
    criticality: 'critical',
    tags: ['database', 'postgres', 'production'],
    connection: {
      endpoint: 'http://localhost:5432/health',
      auth: null
    },
    policy: {
      policy_id: 'pol-postgres-1',
      resource_id: 'prod-postgres-main',
      enabled: true,
      schedule: { type: 'INTERVAL', value: 'PT5M' },
      metrics: ['connection_ok', 'latency_ms'],
      rules: [
        {
          name: 'database_is_up',
          metric: 'connection_ok',
          operator: '==',
          value: true,
          failed_status: 'DOWN'
        }
      ],
      aggregation: { strategy: 'worst_of' }
    },
    source: 'manual'
  },
  {
    id: 'prod-redis-cache',
    name: 'Production Redis Cache',
    type: 'cache_queue',
    subtype: 'redis',
    enabled: true,
    owner: 'platform-team',
    env: 'production',
    criticality: 'high',
    tags: ['cache', 'redis', 'production'],
    connection: {
      endpoint: 'http://localhost:6379/health',
      auth: null
    },
    policy: {
      policy_id: 'pol-redis-1',
      resource_id: 'prod-redis-cache',
      enabled: true,
      schedule: { type: 'INTERVAL', value: 'PT2M' },
      metrics: ['ping_ok', 'latency_ms'],
      rules: [
        {
          name: 'redis_is_up',
          metric: 'ping_ok',
          operator: '==',
          value: true,
          failed_status: 'DOWN'
        }
      ],
      aggregation: { strategy: 'worst_of' }
    },
    source: 'manual'
  },
  {
    id: 'api-users-service',
    name: 'Users API Service',
    type: 'http_service',
    subtype: 'rest_api',
    enabled: true,
    owner: 'backend-team',
    env: 'production',
    criticality: 'critical',
    tags: ['api', 'users', 'production'],
    connection: {
      endpoint: 'http://localhost:8080/health',
      method: 'GET',
      auth: null
    },
    policy: {
      policy_id: 'pol-api-users-1',
      resource_id: 'api-users-service',
      enabled: true,
      schedule: { type: 'INTERVAL', value: 'PT1M' },
      metrics: ['status_code', 'response_time_ms', 'availability'],
      rules: [
        {
          name: 'http_status_ok',
          metric: 'status_code',
          operator: '<',
          value: 400,
          failed_status: 'DOWN'
        },
        {
          name: 'response_time_acceptable',
          metric: 'response_time_ms',
          operator: '<',
          value: 2000,
          failed_status: 'DEGRADED'
        }
      ],
      aggregation: { strategy: 'worst_of' }
    },
    source: 'manual'
  }
];

async function seed() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5
  });

  try {
    console.log('🔄 Connecting to database...');
    const client = await pool.connect();

    try {
      console.log('✅ Connected to database');
      console.log('\n🌱 Seeding sample data...');

      // Insert sample resources
      for (const resource of sampleResources) {
        console.log(`   Inserting resource: ${resource.name}`);

        await client.query(
          `INSERT INTO resources (id, name, type, subtype, enabled, owner, env, criticality, tags, connection, config, policy, source, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
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
             policy = EXCLUDED.policy,
             source = EXCLUDED.source,
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
            resource.tags,
            JSON.stringify(resource.connection),
            JSON.stringify({}), // config
            JSON.stringify(resource.policy),
            resource.source
          ]
        );
      }

      console.log(`\n✅ Inserted ${sampleResources.length} sample resources`);

      // Check results
      const result = await client.query('SELECT id, name, type, env FROM resources ORDER BY name');
      console.log('\n📊 Resources in database:');
      result.rows.forEach((row) => {
        console.log(`   - [${row.id}] ${row.name} (${row.type}, ${row.env})`);
      });

      console.log('\n✨ Seeding completed successfully!');
      console.log('\n💡 Tip: Start the RHC server to begin health checks:');
      console.log('   npm run dev');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('\n❌ Seeding failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
