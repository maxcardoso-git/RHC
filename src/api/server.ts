import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AppConfig } from '../config/index.js';
import { registerRoutes } from './routes.js';

export function buildServer(cfg: AppConfig) {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: false });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  app.register(fastifyStatic, {
    root: join(__dirname, '..', 'public'),
    prefix: '/ui/'
  });

  app.get('/ui', (_req, reply) => {
    reply.sendFile('index.html');
  });

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
