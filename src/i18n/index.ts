import { DEFAULT_LOCALE } from '../domain/catalog.js';
import { Locale } from '../domain/types.js';

export type LocalizedString = Record<Locale, string>;

export function pickLocale<T extends string | LocalizedString>(
  locale: Locale | undefined,
  value: T
): string {
  if (typeof value === 'string') return value;
  const chosen = value[(locale as Locale) || DEFAULT_LOCALE];
  return chosen || value[DEFAULT_LOCALE] || Object.values(value)[0];
}

export const i18nMessages = {
  statusUp: {
    'pt-BR': 'Recurso operacional',
    'en-US': 'Resource is healthy',
    'es-ES': 'Recurso operativo'
  },
  statusDegraded: {
    'pt-BR': 'Recurso degradado',
    'en-US': 'Resource degraded',
    'es-ES': 'Recurso degradado'
  },
  statusDown: {
    'pt-BR': 'Recurso indisponível',
    'en-US': 'Resource unavailable',
    'es-ES': 'Recurso indisponible'
  },
  runtimeDependencies: {
    'pt-BR': 'Dependências Runtime',
    'en-US': 'Runtime Dependencies',
    'es-ES': 'Dependencias Runtime'
  },
  prismaOrm: {
    'pt-BR': 'Prisma ORM',
    'en-US': 'Prisma ORM',
    'es-ES': 'Prisma ORM'
  },
  connection: {
    'pt-BR': 'Conexão',
    'en-US': 'Connection',
    'es-ES': 'Conexión'
  },
  poolExhausted: {
    'pt-BR': 'Pool exausto',
    'en-US': 'Pool exhausted',
    'es-ES': 'Pool agotado'
  },
  latencyP95: {
    'pt-BR': 'Latência p95',
    'en-US': 'Latency p95',
    'es-ES': 'Latencia p95'
  },
  latencyAvg: {
    'pt-BR': 'Latência média',
    'en-US': 'Avg latency',
    'es-ES': 'Latencia media'
  },
  errorRate: {
    'pt-BR': 'Taxa de erro (5 min)',
    'en-US': 'Error rate (5m)',
    'es-ES': 'Tasa de error (5m)'
  },
  lastErrorCode: {
    'pt-BR': 'Último código de erro',
    'en-US': 'Last error code',
    'es-ES': 'Último código de error'
  }
} satisfies Record<string, LocalizedString>;
