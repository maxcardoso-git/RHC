import { DEFAULT_LOCALE } from '../domain/catalog.js';
import { Locale } from '../domain/types.js';

export interface AppConfig {
  serviceName: string;
  env: string;
  port: number;
  apiKey?: string;
  defaultLocale: Locale;
  resourceRegistry: {
    baseUrl: string;
    apiKey?: string;
    cacheSeconds: number;
  };
  scheduler: {
    loopIntervalSeconds: number;
    jitterMaxSeconds: number;
  };
  logging: {
    level: string;
  };
}

export function loadConfig(): AppConfig {
  return {
    serviceName: process.env.SERVICE_NAME || 'resource-health-checker',
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiKey: process.env.INTERNAL_API_KEY,
    defaultLocale: (process.env.DEFAULT_LOCALE as Locale) || DEFAULT_LOCALE,
    resourceRegistry: {
      baseUrl: process.env.RESOURCE_REGISTRY_BASE_URL || 'http://localhost:3000/api/v1/orchestrator',
      apiKey: process.env.RESOURCE_REGISTRY_API_KEY,
      cacheSeconds: parseInt(process.env.RESOURCE_REGISTRY_CACHE_SECONDS || '30', 10)
    },
    scheduler: {
      loopIntervalSeconds: parseInt(process.env.SCHEDULER_LOOP_SECONDS || '30', 10),
      jitterMaxSeconds: parseInt(process.env.SCHEDULER_JITTER_MAX_SECONDS || '30', 10)
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info'
    }
  };
}
