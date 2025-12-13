import { ResourceDescriptor, ResourceHealthStatus } from '../domain/types.js';

export const sampleResources: ResourceDescriptor[] = [
  {
    id: 'postgres_main',
    name: 'Postgres Main',
    type: 'database',
    subtype: 'postgres',
    enabled: true,
    owner: 'data-platform',
    env: 'prod',
    criticality: 'tier1',
    tags: ['prod', 'tier1', 'database'],
    policy: {
      policy_id: 'hp_postgres_main',
      resource_id: 'postgres_main',
      enabled: true,
      schedule: { type: 'INTERVAL', value: 'PT10M' },
      timeouts: { perMetricMs: 2000, perCheckMs: 6000 },
      retries: { maxAttempts: 2, backoff: 'exponential', baseDelayMs: 200 },
      metrics: [{ name: 'connection_ok' }, { name: 'latency_ms' }, { name: 'replication_lag_ms' }],
      rules: [
        {
          rule_id: 'r1',
          metric: 'connection_ok',
          operator: '==',
          threshold: true,
          onFailStatus: 'DOWN',
          severity: 'CRITICAL'
        },
        {
          rule_id: 'r2',
          metric: 'latency_ms',
          operator: '<=',
          threshold: 200,
          onFailStatus: 'DEGRADED',
          severity: 'HIGH'
        },
        {
          rule_id: 'r3',
          metric: 'replication_lag_ms',
          operator: '<=',
          threshold: 1000,
          onFailStatus: 'DEGRADED',
          severity: 'MEDIUM'
        }
      ],
      aggregation: { strategy: 'worst_of' },
      cooldown: { perResourceMinutes: 30, perRuleMinutes: 15 },
      notifications: { emitEvents: true, webhooks: ['noc_internal'] },
      tags: ['prod', 'tier1', 'database']
    }
  },
  {
    id: 'openai_gpt4',
    name: 'OpenAI GPT-4',
    type: 'llm_provider',
    subtype: 'openai',
    enabled: true,
    owner: 'ai-platform',
    env: 'prod',
    criticality: 'tier1',
    tags: ['prod', 'tier1', 'llm_provider'],
    policy: {
      policy_id: 'hp_openai_primary',
      resource_id: 'openai_gpt4',
      enabled: true,
      schedule: { type: 'INTERVAL', value: 'PT30M' },
      timeouts: { perMetricMs: 6000, perCheckMs: 15000 },
      retries: { maxAttempts: 1, backoff: 'fixed', baseDelayMs: 0 },
      metrics: [{ name: 'availability' }, { name: 'response_time_ms' }, { name: 'error_rate_pct' }],
      rules: [
        {
          rule_id: 'r1',
          metric: 'availability',
          operator: '==',
          threshold: true,
          onFailStatus: 'DOWN',
          severity: 'CRITICAL'
        },
        {
          rule_id: 'r2',
          metric: 'response_time_ms',
          operator: '<=',
          threshold: 3000,
          onFailStatus: 'DEGRADED',
          severity: 'HIGH'
        },
        {
          rule_id: 'r3',
          metric: 'error_rate_pct',
          operator: '<=',
          threshold: 2,
          onFailStatus: 'DEGRADED',
          severity: 'HIGH'
        }
      ],
      aggregation: { strategy: 'worst_of' },
      cooldown: { perResourceMinutes: 20, perRuleMinutes: 10 },
      notifications: { emitEvents: true, webhooks: ['orchestrator_router'] },
      tags: ['prod', 'tier1', 'llm_provider']
    }
  }
];

export const initialStatus: ResourceHealthStatus[] = sampleResources.map((res) => ({
  resource_id: res.id,
  resource_type: res.type,
  resource_subtype: res.subtype,
  current_status: 'DEGRADED',
  consecutive_failures: 0,
  summary: {
    message: {
      'pt-BR': 'Aguardando primeira checagem',
      'en-US': 'Waiting first check',
      'es-ES': 'Esperando primera verificación'
    }
  }
}));
