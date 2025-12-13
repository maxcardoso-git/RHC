export type Locale = 'pt-BR' | 'en-US' | 'es-ES';

export type ResourceType =
  | 'database'
  | 'cache_queue'
  | 'http_service'
  | 'llm_provider'
  | 'vector_db';

export type ResourceSubtype =
  | 'postgres'
  | 'mongo'
  | 'redis'
  | 'rabbitmq'
  | 'kafka'
  | 'internal_api'
  | 'external_api'
  | 'backend'
  | 'openai'
  | 'gemini'
  | 'anthropic'
  | 'local_vllm'
  | 'local_tgi'
  | 'pgvector'
  | 'pinecone'
  | 'weaviate'
  | 'qdrant';

export type HealthStatus = 'UP' | 'DEGRADED' | 'DOWN';

export type ExecutionType = 'SCHEDULED' | 'MANUAL' | 'EVENT';

export type Operator =
  | '<'
  | '<='
  | '>'
  | '>='
  | '=='
  | '!='
  | 'in'
  | 'not_in'
  | 'regex'
  | 'exists';

export type MetricValue = boolean | number | string | Record<string, unknown>;

export interface MetricDefinition {
  name: string;
  type:
    | 'boolean'
    | 'number'
    | 'string'
    | 'percentage'
    | 'duration_ms'
    | 'rate_per_min'
    | 'count';
  description: Record<Locale, string>;
}

export interface RuleDefinition {
  rule_id: string;
  metric: string;
  operator: Operator;
  threshold?: MetricValue;
  onFailStatus: HealthStatus;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface HealthPolicy {
  policy_id: string;
  resource_id: string;
  enabled: boolean;
  schedule: { type: 'CRON' | 'INTERVAL'; value: string };
  timeouts?: { perMetricMs?: number; perCheckMs?: number };
  retries?: { maxAttempts: number; backoff: 'exponential' | 'fixed'; baseDelayMs: number };
  metrics: Array<{ name: string }>;
  rules: RuleDefinition[];
  aggregation?: { strategy: 'worst_of' | 'weighted_score' | 'quorum' | 'custom_expression' };
  cooldown?: { perResourceMinutes?: number; perRuleMinutes?: number };
  notifications?: { emitEvents?: boolean; webhooks?: string[] };
  tags?: string[];
}

export interface ResourceDescriptor {
  id: string;
  name: string;
  type: ResourceType;
  subtype?: ResourceSubtype;
  enabled: boolean;
  owner?: string;
  env?: string;
  criticality?: 'tier1' | 'tier2' | 'tier3';
  tags?: string[];
  connection?: Record<string, unknown>;
  policy?: HealthPolicy;
}

export interface ResourceHealthStatus {
  resource_id: string;
  resource_name?: string;
  resource_type: ResourceType;
  resource_subtype?: ResourceSubtype;
  env?: string;
  current_status: HealthStatus;
  last_check_at?: string;
  last_success_at?: string;
  consecutive_failures: number;
  summary?: {
    message?: Record<Locale, string>;
    primary_cause?: string;
    failed_rules?: string[];
    key_metrics?: Record<string, unknown>;
    runtime_dependencies?: Record<
      string,
      {
        status: HealthStatus;
        connection_ok?: boolean;
        pool_exhausted?: boolean;
        latency_p95_ms?: number | null;
        latency_avg_ms?: number | null;
        error_rate_pct_5m?: number | null;
        last_error_code?: string | null;
      }
    >;
  };
  updated_at?: string;
}

export interface RuleEvaluationResult {
  rule_id: string;
  metric: string;
  passed: boolean;
  operator: Operator;
  threshold?: MetricValue;
  observed: MetricValue;
  severity: RuleDefinition['severity'];
  statusOnFail: HealthStatus;
}

export interface ResourceHealthCheck {
  id: string;
  resource_id: string;
  executed_at: string;
  execution_type: ExecutionType;
  final_status: HealthStatus;
  duration_ms: number;
  metrics: Record<string, MetricValue>;
  rule_evaluations: Record<string, RuleEvaluationResult>;
  error_message?: string;
  collector_debug?: Record<string, unknown>;
}

export interface MetricCollectorResult {
  metrics: Record<string, MetricValue>;
  debug?: Record<string, unknown>;
}
