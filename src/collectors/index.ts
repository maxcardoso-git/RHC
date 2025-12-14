import { MetricCollectorResult, ResourceDescriptor } from '../domain/types.js';
import { logger } from '../utils/logger.js';

export async function runCollector(resource: ResourceDescriptor): Promise<MetricCollectorResult> {
  switch (resource.type) {
    case 'database':
      return await passiveCollector(resource, {
        connection_ok: false,
        latency_ms: null,
        replication_lag_ms: null
      });
    case 'llm_provider':
      return await passiveCollector(resource, {
        availability: false,
        response_time_ms: null,
        error_rate_pct: null
      });
    case 'http_service':
      return await httpHealthCollector(resource);
    case 'cache_queue':
      return await passiveCollector(resource, {
        ping_ok: false,
        latency_ms: null,
        queue_depth: null,
        consumer_lag: null
      });
    case 'vector_db':
      return await passiveCollector(resource, {
        index_available: false,
        query_latency_ms: null,
        insert_latency_ms: null,
        collection_size: null
      });
    default:
      return { metrics: {} };
  }
}

async function passiveCollector(
  resource: ResourceDescriptor,
  defaultMetrics: Record<string, import('../domain/types.js').MetricValue | null>
): Promise<MetricCollectorResult> {
  const endpoint = (resource.connection as any)?.endpoint as string | undefined;
  if (endpoint) {
    return httpHealthCollector(resource);
  }
  const sanitized: Record<string, import('../domain/types.js').MetricValue> = {};
  Object.entries(defaultMetrics).forEach(([k, v]) => {
    if (v !== null && v !== undefined) {
      sanitized[k] = v;
    }
  });
  return { metrics: sanitized, debug: { note: 'no endpoint; passive metrics' } };
}

async function httpHealthCollector(resource: ResourceDescriptor): Promise<MetricCollectorResult> {
  const endpoint = (resource.connection as any)?.endpoint as string | undefined;
  if (!endpoint) {
    return {
      metrics: {
        status_code: 503,
        response_time_ms: 0
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
