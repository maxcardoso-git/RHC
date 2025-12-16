import { FastifyInstance } from 'fastify';
import { METRIC_CATALOG } from '../domain/catalog.js';
import { Locale } from '../domain/types.js';
import { pickLocale } from '../i18n/index.js';
import { HealthService } from '../services/health-service.js';
import { ResourceRegistryClient } from '../services/resource-registry-client.js';
import { CatalogService } from '../services/catalog-service.js';
import { memoryStore } from '../stores/memory-store.js';
import { dockerService } from '../services/docker-service.js';

function pickUserLocale(header?: string | string[]): Locale | undefined {
  if (!header) return undefined;
  const raw = Array.isArray(header) ? header[0] : header;
  return raw.split(',')[0].trim() as Locale;
}

function localizeSummary(locale: Locale | undefined, summary: any) {
  if (!summary) return summary;
  if (summary.message) {
    return { ...summary, message: pickLocale(locale, summary.message) };
  }
  return summary;
}

export async function registerRoutes(
  app: FastifyInstance,
  deps: { healthService: HealthService; registryClient: ResourceRegistryClient; catalog: CatalogService }
) {
  const base = '/api/v1/resource-health';

  app.post(`${base}/check/:resource_id`, async (request, reply) => {
    const resourceId = (request.params as { resource_id: string }).resource_id;
    try {
      const resource = deps.catalog.get(resourceId);
      if (!resource) {
        reply.code(404).send({ code: 'RESOURCE_NOT_FOUND' });
        return;
      }
      const check = await deps.healthService.runCheck(resourceId, 'MANUAL', resource);
      reply.code(202).send({
        check_id: check.id,
        resource_id: check.resource_id,
        queued_at: check.executed_at,
        estimated_start: check.executed_at
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'RESOURCE_NOT_FOUND') {
        reply.code(404).send({ code: 'RESOURCE_NOT_FOUND' });
        return;
      }
      if (err instanceof Error && err.message === 'POLICY_DISABLED') {
        reply.code(409).send({ code: 'POLICY_DISABLED' });
        return;
      }
      reply.code(500).send({ code: 'INTERNAL_ERROR' });
    }
  });

  app.get(`${base}/status/:resource_id`, async (request, reply) => {
    const resourceId = (request.params as { resource_id: string }).resource_id;
    const locale = pickUserLocale(request.headers['accept-language']);
    const status = await deps.healthService.getStatus(resourceId);
    if (!status) {
      reply.code(404).send({ code: 'RESOURCE_NOT_FOUND' });
      return;
    }
    reply.send({ ...status, summary: localizeSummary(locale, status.summary) });
  });

  app.get(`${base}/status`, async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const locale = pickUserLocale(request.headers['accept-language']);
    const items = await deps.healthService.listStatus({
      type: query.type,
      subtype: query.subtype,
      status: query.status as any,
      tag: query.tag,
      owner: query.owner,
      env: query.env,
      app: query.app
    });
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;
    const sliced = items.slice(offset, offset + limit).map((s) => ({
      ...s,
      summary: localizeSummary(locale, s.summary)
    }));
    reply.send({ items: sliced, paging: { limit, offset, total: items.length } });
  });

  app.get(`${base}/history/:resource_id`, async (request, reply) => {
    const resourceId = (request.params as { resource_id: string }).resource_id;
    const query = request.query as Record<string, string | undefined>;
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;
    const { items, total } = await deps.healthService.listChecks(resourceId, limit, offset);
    reply.send({ items, paging: { limit, offset, total } });
  });

  app.get(`${base}/checks/:check_id`, async (request, reply) => {
    const checkId = (request.params as { check_id: string }).check_id;
    const check = await deps.healthService.getCheck(checkId);
    if (!check) {
      reply.code(404).send({ code: 'CHECK_NOT_FOUND' });
      return;
    }
    reply.send(check);
  });

  app.get(`${base}/schema/metrics`, async (_request, reply) => {
    reply.send({ catalogByResourceType: METRIC_CATALOG });
  });

  app.get(`${base}/resources`, async (_request, reply) => {
    const items = deps.catalog.list();
    reply.send({ items, source: 'catalog' });
  });

  // Catalog management
  app.post(`${base}/catalog/import`, async (_request, reply) => {
    try {
      const result = await deps.catalog.importFromRegistry();
      reply.send({ imported: result.imported });
    } catch (err) {
      reply.code(500).send({ code: 'IMPORT_FAILED' });
    }
  });

  app.get(`${base}/catalog`, async (_request, reply) => {
    reply.send({ items: deps.catalog.list() });
  });

  app.get(`${base}/catalog/:resource_id`, async (request, reply) => {
    const resourceId = (request.params as { resource_id: string }).resource_id;
    const res = deps.catalog.get(resourceId);
    if (!res) {
      reply.code(404).send({ code: 'RESOURCE_NOT_FOUND' });
      return;
    }
    reply.send(res);
  });

  app.post(`${base}/catalog`, async (request, reply) => {
    const body = request.body as any;
    if (!body?.id || !body?.name || !body?.type) {
      reply.code(400).send({ code: 'INVALID_BODY' });
      return;
    }
    const saved = deps.catalog.upsert(body, 'manual');
    reply.code(201).send(saved);
  });

  app.patch(`${base}/catalog/:resource_id`, async (request, reply) => {
    const resourceId = (request.params as { resource_id: string }).resource_id;
    const body = request.body as any;
    const existing = deps.catalog.get(resourceId);
    if (!existing) {
      reply.code(404).send({ code: 'RESOURCE_NOT_FOUND' });
      return;
    }
    const saved = deps.catalog.upsert({ ...existing, ...body, id: resourceId }, 'manual');
    reply.send(saved);
  });

  app.delete(`${base}/catalog/:resource_id`, async (request, reply) => {
    const resourceId = (request.params as { resource_id: string }).resource_id;
    const ok = deps.catalog.delete(resourceId);
    memoryStore.removeResource(resourceId);
    if (!ok) {
      reply.code(404).send({ code: 'RESOURCE_NOT_FOUND' });
      return;
    }
    reply.code(204).send();
  });

  // Restart service
  app.post(`${base}/restart/:resource_id`, async (request, reply) => {
    const resourceId = (request.params as { resource_id: string }).resource_id;

    // Check if Docker is available
    const dockerAvailable = await dockerService.isAvailable();
    if (!dockerAvailable) {
      reply.code(503).send({
        code: 'DOCKER_UNAVAILABLE',
        message: 'Docker socket not available. Ensure /var/run/docker.sock is mounted.'
      });
      return;
    }

    // Get resource from catalog
    const resource = deps.catalog.get(resourceId);
    if (!resource) {
      reply.code(404).send({ code: 'RESOURCE_NOT_FOUND' });
      return;
    }

    // Check if restart is configured
    if (!resource.restart_config) {
      reply.code(400).send({
        code: 'RESTART_NOT_CONFIGURED',
        message: `Resource '${resource.name}' does not have restart configuration`
      });
      return;
    }

    // Perform restart
    const result = await dockerService.restartContainer(resource.restart_config);

    if (result.success) {
      // Trigger a health check after restart
      setTimeout(async () => {
        try {
          await deps.healthService.runCheck(resourceId, 'MANUAL', resource);
        } catch {
          // ignore errors
        }
      }, 5000);

      reply.send({
        success: true,
        resource_id: resourceId,
        container_name: result.container_name,
        message: result.message,
        duration_ms: result.duration_ms
      });
    } else {
      reply.code(500).send({
        code: 'RESTART_FAILED',
        resource_id: resourceId,
        message: result.message,
        duration_ms: result.duration_ms
      });
    }
  });

  // Check Docker availability
  app.get(`${base}/docker/status`, async (_request, reply) => {
    const available = await dockerService.isAvailable();
    if (available) {
      const containers = await dockerService.listContainers();
      reply.send({ available: true, containers });
    } else {
      reply.send({ available: false, message: 'Docker socket not available' });
    }
  });
}
