import { loadConfig } from './config/index.js';
import { buildServer } from './api/server.js';
import { Scheduler } from './worker/scheduler.js';
import { logger } from './utils/logger.js';
import { ResourceRegistryClient } from './services/resource-registry-client.js';
import { HealthService } from './services/health-service.js';
import { CatalogService } from './services/catalog-service.js';

async function main() {
  const cfg = loadConfig();
  const registryClient = new ResourceRegistryClient(cfg);
  const catalog = new CatalogService(cfg.catalog.filePath, registryClient);
  await catalog.ensureSeeded();
  const healthService = new HealthService(catalog);
  const app = buildServer(cfg, { healthService, registryClient, catalog });
  const scheduler = new Scheduler(cfg, catalog, healthService);

  await app.listen({ port: cfg.port, host: '0.0.0.0' });
  logger.info({ port: cfg.port, env: cfg.env }, 'API listening');
  scheduler.start();
}

main().catch((err) => {
  logger.error({ err }, 'fatal error on startup');
  process.exit(1);
});
