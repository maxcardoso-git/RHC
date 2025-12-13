import { loadConfig } from './config/index.js';
import { buildServer } from './api/server.js';
import { Scheduler } from './worker/scheduler.js';
import { logger } from './utils/logger.js';

async function main() {
  const cfg = loadConfig();
  const app = buildServer(cfg);
  const scheduler = new Scheduler(cfg);

  await app.listen({ port: cfg.port, host: '0.0.0.0' });
  logger.info({ port: cfg.port, env: cfg.env }, 'API listening');
  scheduler.start();
}

main().catch((err) => {
  logger.error({ err }, 'fatal error on startup');
  process.exit(1);
});
