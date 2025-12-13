import { MetricCollectorResult, ResourceDescriptor } from '../domain/types.js';
import { logger } from '../utils/logger.js';

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
      return await httpHealthCollector(resource);
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

async function httpHealthCollector(resource: ResourceDescriptor): Promise<MetricCollectorResult> {
  const endpoint = (resource.connection as any)?.endpoint as string | undefined;
  if (!endpoint) {
    return {
      metrics: {
        status_code: 200,
        response_time_ms: simulateLatency(80, 100)
      }
    };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const started = Date.now();
  try {
    const res = await fetch(endpoint, { signal: controller.signal, headers: { Accept: 'application/json' } });
    const response_time_ms = Date.now() - started;
    const contentType = res.headers.get('content-type') || '';
    let body: any = null;
    if (contentType.includes('application/json')) {
      try {
        body = await res.json();
      } catch {
        body = null;
      }
    }
    const metrics: Record<string, import('../domain/types.js').MetricValue> = {
      status_code: res.status,
      response_time_ms
    };
    if (body?.runtime_dependencies?.prisma) {
      const prisma = body.runtime_dependencies.prisma;
      metrics.prisma_connection_ok = prisma.prisma_connection_ok ?? prisma.connection_ok ?? null;
      metrics.prisma_query_latency_ms_avg = prisma.prisma_query_latency_ms_avg ?? prisma.latency_avg ?? null;
      metrics.prisma_query_latency_ms_p95 = prisma.prisma_query_latency_ms_p95 ?? prisma.latency_p95 ?? null;
      metrics.prisma_error_rate_pct_5m = prisma.prisma_error_rate_pct_5m ?? prisma.error_rate ?? null;
      metrics.prisma_pool_exhausted = prisma.prisma_pool_exhausted ?? prisma.pool_exhausted ?? null;
      metrics.prisma_last_error_code = prisma.prisma_last_error_code ?? prisma.last_error_code ?? null;
    }
    return { metrics, debug: { source: 'http_health', body: !!body } };
  } catch (err) {
    logger.warn({ err, resourceId: resource.id }, 'http health collector failed');
    return {
      metrics: {
        status_code: 503,
        response_time_ms: Date.now() - started,
        prisma_connection_ok: false
      },
      debug: { error: err instanceof Error ? err.message : 'unknown' }
    };
  } finally {
    clearTimeout(timeout);
  }
}
