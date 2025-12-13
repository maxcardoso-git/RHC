import { Locale, MetricDefinition, ResourceSubtype, ResourceType } from './types.js';

type MetricCatalogEntry = {
  resourceType: ResourceType;
  metrics: MetricDefinition[];
};

export const METRIC_CATALOG: MetricCatalogEntry[] = [
  {
    resourceType: 'database',
    metrics: [
      {
        name: 'connection_ok',
        type: 'boolean',
        description: {
          'pt-BR': 'Consegue conectar e executar uma query simples/ping.',
          'en-US': 'Can connect and execute a simple query/ping.',
          'es-ES': 'Puede conectar y ejecutar una consulta simple/ping.'
        }
      },
      {
        name: 'latency_ms',
        type: 'duration_ms',
        description: {
          'pt-BR': 'Latência do ping/query simples.',
          'en-US': 'Latency of ping/simple query.',
          'es-ES': 'Latencia del ping/consulta simple.'
        }
      },
      {
        name: 'active_connections',
        type: 'count',
        description: {
          'pt-BR': 'Conexões ativas no momento da checagem (quando suportado).',
          'en-US': 'Active connections at check time (when supported).',
          'es-ES': 'Conexiones activas en el momento de la verificación (cuando se soporta).'
        }
      },
      {
        name: 'replication_lag_ms',
        type: 'duration_ms',
        description: {
          'pt-BR': 'Lag de replicação (read replica/cluster) quando aplicável.',
          'en-US': 'Replication lag (read replica/cluster) when applicable.',
          'es-ES': 'Lag de replicación (réplica/cluster) cuando aplique.'
        }
      },
      {
        name: 'lock_wait_ms',
        type: 'duration_ms',
        description: {
          'pt-BR': 'Tempo de espera em locks relevantes (quando disponível).',
          'en-US': 'Wait time on relevant locks (when available).',
          'es-ES': 'Tiempo de espera en locks relevantes (cuando disponible).'
        }
      }
    ]
  },
  {
    resourceType: 'cache_queue',
    metrics: [
      {
        name: 'ping_ok',
        type: 'boolean',
        description: {
          'pt-BR': 'Ping/handshake básico com o recurso.',
          'en-US': 'Basic ping/handshake with the resource.',
          'es-ES': 'Ping/handshake básico con el recurso.'
        }
      },
      {
        name: 'latency_ms',
        type: 'duration_ms',
        description: {
          'pt-BR': 'Latência do ping/operação mínima.',
          'en-US': 'Latency of ping/minimal operation.',
          'es-ES': 'Latencia del ping/operación mínima.'
        }
      },
      {
        name: 'memory_usage_pct',
        type: 'percentage',
        description: {
          'pt-BR': 'Uso de memória (Redis) quando suportado.',
          'en-US': 'Memory usage (Redis) when supported.',
          'es-ES': 'Uso de memoria (Redis) cuando se soporta.'
        }
      },
      {
        name: 'queue_depth',
        type: 'count',
        description: {
          'pt-BR': 'Tamanho da fila/backlog (BullMQ/Rabbit/Kafka abstrato).',
          'en-US': 'Queue depth/backlog (BullMQ/Rabbit/Kafka abstract).',
          'es-ES': 'Tamaño de cola/backlog (BullMQ/Rabbit/Kafka abstracto).'
        }
      },
      {
        name: 'consumer_lag',
        type: 'count',
        description: {
          'pt-BR': 'Lag de consumidor (Kafka) quando aplicável.',
          'en-US': 'Consumer lag (Kafka) when applicable.',
          'es-ES': 'Lag de consumidor (Kafka) cuando aplique.'
        }
      }
    ]
  },
  {
    resourceType: 'http_service',
    metrics: [
      {
        name: 'status_code',
        type: 'number',
        description: {
          'pt-BR': 'Status HTTP retornado pelo endpoint de health.',
          'en-US': 'HTTP status returned by the health endpoint.',
          'es-ES': 'Estado HTTP devuelto por el endpoint de health.'
        }
      },
      {
        name: 'response_time_ms',
        type: 'duration_ms',
        description: {
          'pt-BR': 'Tempo total de resposta do healthcheck.',
          'en-US': 'Total response time of the healthcheck.',
          'es-ES': 'Tiempo total de respuesta del healthcheck.'
        }
      },
      {
        name: 'prisma_connection_ok',
        type: 'boolean',
        description: {
          'pt-BR': 'Conexão Prisma/DB funcionando.',
          'en-US': 'Prisma/DB connection ok.',
          'es-ES': 'Conexión Prisma/DB funcionando.'
        }
      },
      {
        name: 'prisma_query_latency_ms_avg',
        type: 'duration_ms',
        description: {
          'pt-BR': 'Latência média das queries Prisma (janela curta).',
          'en-US': 'Average Prisma query latency (short window).',
          'es-ES': 'Latencia promedio de queries Prisma (ventana corta).'
        }
      },
      {
        name: 'prisma_query_latency_ms_p95',
        type: 'duration_ms',
        description: {
          'pt-BR': 'Latência p95 das queries Prisma (janela curta).',
          'en-US': 'p95 Prisma query latency (short window).',
          'es-ES': 'Latencia p95 de queries Prisma (ventana corta).'
        }
      },
      {
        name: 'prisma_error_rate_pct_5m',
        type: 'percentage',
        description: {
          'pt-BR': 'Taxa de erro Prisma em 5 minutos.',
          'en-US': 'Prisma error rate over 5 minutes.',
          'es-ES': 'Tasa de error de Prisma en 5 minutos.'
        }
      },
      {
        name: 'prisma_pool_exhausted',
        type: 'boolean',
        description: {
          'pt-BR': 'Heurística de exaustão do pool Prisma/DB.',
          'en-US': 'Heuristic for Prisma/DB pool exhaustion.',
          'es-ES': 'Heurística de agotamiento del pool Prisma/DB.'
        }
      },
      {
        name: 'prisma_last_error_code',
        type: 'string',
        description: {
          'pt-BR': 'Último código de erro Prisma visto.',
          'en-US': 'Last Prisma error code seen.',
          'es-ES': 'Último código de error Prisma visto.'
        }
      },
      {
        name: 'timeout_rate_pct',
        type: 'percentage',
        description: {
          'pt-BR': 'Taxa de timeout em janela deslizante (derivada do histórico).',
          'en-US': 'Timeout rate in a sliding window (derived from history).',
          'es-ES': 'Tasa de timeout en una ventana deslizante (derivada del historial).'
        }
      },
      {
        name: 'error_rate_pct',
        type: 'percentage',
        description: {
          'pt-BR': 'Taxa de erro (5xx) em janela deslizante (derivada do histórico).',
          'en-US': 'Error rate (5xx) in sliding window (derived from history).',
          'es-ES': 'Tasa de error (5xx) en ventana deslizante (derivada del historial).'
        }
      }
    ]
  },
  {
    resourceType: 'llm_provider',
    metrics: [
      {
        name: 'availability',
        type: 'boolean',
        description: {
          'pt-BR': 'Disponibilidade do provedor (resposta válida no teste sintético).',
          'en-US': 'Provider availability (valid response on synthetic test).',
          'es-ES': 'Disponibilidad del proveedor (respuesta válida en prueba sintética).'
        }
      },
      {
        name: 'response_time_ms',
        type: 'duration_ms',
        description: {
          'pt-BR': 'Latência do teste sintético (prompt curto).',
          'en-US': 'Latency of synthetic test (short prompt).',
          'es-ES': 'Latencia de la prueba sintética (prompt corto).'
        }
      },
      {
        name: 'error_rate_pct',
        type: 'percentage',
        description: {
          'pt-BR': 'Taxa de erro em janela (timeouts, 429, 5xx, etc.).',
          'en-US': 'Error rate in window (timeouts, 429, 5xx, etc.).',
          'es-ES': 'Tasa de error en ventana (timeouts, 429, 5xx, etc.).'
        }
      },
      {
        name: 'tokens_per_second',
        type: 'number',
        description: {
          'pt-BR': 'Throughput estimado (quando mensurável no runtime local ou via instrumentação).',
          'en-US': 'Estimated throughput (when measurable in local runtime or via instrumentation).',
          'es-ES': 'Throughput estimado (cuando medible en runtime local o vía instrumentación).'
        }
      },
      {
        name: 'rate_limit_remaining',
        type: 'number',
        description: {
          'pt-BR': 'Saldo de rate limit (quando disponível via headers).',
          'en-US': 'Remaining rate limit (when available via headers).',
          'es-ES': 'Saldo de rate limit (cuando disponible vía headers).'
        }
      }
    ]
  },
  {
    resourceType: 'vector_db',
    metrics: [
      {
        name: 'index_available',
        type: 'boolean',
        description: {
          'pt-BR': 'Índice disponível/operacional.',
          'en-US': 'Index available/operational.',
          'es-ES': 'Índice disponible/operativo.'
        }
      },
      {
        name: 'query_latency_ms',
        type: 'duration_ms',
        description: {
          'pt-BR': 'Latência de consulta de teste (query sintética).',
          'en-US': 'Latency of test query (synthetic query).',
          'es-ES': 'Latencia de consulta de prueba (consulta sintética).'
        }
      },
      {
        name: 'insert_latency_ms',
        type: 'duration_ms',
        description: {
          'pt-BR': 'Latência de inserção/upsert de teste (quando permitido).',
          'en-US': 'Latency of test insert/upsert (when allowed).',
          'es-ES': 'Latencia de inserción/upsert de prueba (cuando se permite).'
        }
      },
      {
        name: 'collection_size',
        type: 'count',
        description: {
          'pt-BR': 'Tamanho da coleção/namespace (quando disponível).',
          'en-US': 'Collection/namespace size (when available).',
          'es-ES': 'Tamaño de colección/namespace (cuando disponible).'
        }
      }
    ]
  }
];

export const RESOURCE_TYPES: Array<{ type: ResourceType; subtypes: ResourceSubtype[] }> = [
  { type: 'database', subtypes: ['postgres', 'mongo'] },
  { type: 'cache_queue', subtypes: ['redis', 'rabbitmq', 'kafka'] },
  { type: 'http_service', subtypes: ['internal_api', 'external_api', 'backend'] },
  { type: 'llm_provider', subtypes: ['openai', 'gemini', 'anthropic', 'local_vllm', 'local_tgi'] },
  { type: 'vector_db', subtypes: ['pgvector', 'pinecone', 'weaviate', 'qdrant'] }
];

export function getMetricCatalogByType(type: ResourceType): MetricDefinition[] {
  const entry = METRIC_CATALOG.find((item) => item.resourceType === type);
  return entry ? entry.metrics : [];
}

export const DEFAULT_LOCALE: Locale = 'pt-BR';
