import { MetricCollectorResult, ResourceDescriptor } from '../domain/types.js';

function simulateLatency(base: number, variance: number): number {
  const jitter = Math.random() * variance;
  return Math.round(base + jitter);
}

export async function runCollector(resource: ResourceDescriptor): Promise<MetricCollectorResult> {
  switch (resource.type) {
    case 'database':
      return {
        metrics: {
          connection_ok: true,
          latency_ms: simulateLatency(90, 60),
          replication_lag_ms: simulateLatency(200, 300)
        },
        debug: { simulated: true }
      };
    case 'llm_provider':
      return {
        metrics: {
          availability: Math.random() > 0.05,
          response_time_ms: simulateLatency(500, 1200),
          error_rate_pct: Math.round(Math.random() * 3)
        }
      };
    case 'http_service':
      return {
        metrics: {
          status_code: 200,
          response_time_ms: simulateLatency(80, 100),
          timeout_rate_pct: Math.round(Math.random() * 2),
          error_rate_pct: Math.round(Math.random() * 1.5)
        }
      };
    case 'cache_queue':
      return {
        metrics: {
          ping_ok: true,
          latency_ms: simulateLatency(20, 30),
          queue_depth: Math.round(Math.random() * 50),
          consumer_lag: Math.round(Math.random() * 10)
        }
      };
    case 'vector_db':
      return {
        metrics: {
          index_available: true,
          query_latency_ms: simulateLatency(60, 90),
          insert_latency_ms: simulateLatency(80, 120),
          collection_size: Math.round(Math.random() * 1000)
        }
      };
    default:
      return { metrics: {} };
  }
}
