import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AppConfig } from '../config/index.js';
import { registerRoutes } from './routes.js';
import { HealthService } from '../services/health-service.js';
import { ResourceRegistryClient } from '../services/resource-registry-client.js';
import { CatalogService } from '../services/catalog-service.js';

export function buildServer(cfg: AppConfig, deps: { healthService: HealthService; registryClient: ResourceRegistryClient; catalog: CatalogService }) {
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

  // Home: redirect to dashboard
  app.get('/', (_req, reply) => {
    reply.redirect('/ui/dashboard.html');
  });

  app.addHook('onRequest', async (request, reply) => {
    if (!cfg.apiKey) return;
    const headerKey = request.headers['x-internal-api-key'];
    if (headerKey !== cfg.apiKey) {
      reply.code(401).send({ code: 'UNAUTHORIZED' });
    }
  });

  app.get('/healthz', async () => ({ status: 'ok', service: cfg.serviceName }));

  app.register((instance, _opts, done) => {
    registerRoutes(instance, deps).then(() => done()).catch(done);
  });

  return app;
}
