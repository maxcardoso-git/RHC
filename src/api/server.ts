import Fastify from 'fastify';
import cors from '@fastify/cors';
import { AppConfig } from '../config/index.js';
import { registerRoutes } from './routes.js';

export function buildServer(cfg: AppConfig) {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: false });

  app.addHook('onRequest', async (request, reply) => {
    if (!cfg.apiKey) return;
    const headerKey = request.headers['x-internal-api-key'];
    if (headerKey !== cfg.apiKey) {
      reply.code(401).send({ code: 'UNAUTHORIZED' });
    }
  });

  app.get('/healthz', async () => ({ status: 'ok', service: cfg.serviceName }));

  app.register(registerRoutes);

  return app;
}
