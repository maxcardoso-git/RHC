import { FastifyInstance } from 'fastify';
import { METRIC_CATALOG } from '../domain/catalog.js';
import { Locale } from '../domain/types.js';
import { pickLocale } from '../i18n/index.js';
import { HealthService } from '../services/health-service.js';
import { ResourceRegistryClient } from '../services/resource-registry-client.js';
import { CatalogService } from '../services/catalog-service.js';
import { memoryStore } from '../stores/memory-store.js';

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
    const status = deps.healthService.getStatus(resourceId);
    if (!status) {
      reply.code(404).send({ code: 'RESOURCE_NOT_FOUND' });
      return;
    }
    reply.send({ ...status, summary: localizeSummary(locale, status.summary) });
  });

  app.get(`${base}/status`, async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const locale = pickUserLocale(request.headers['accept-language']);
    const items = deps.healthService.listStatus({
      type: query.type,
      subtype: query.subtype,
      status: query.status as any,
      tag: query.tag,
      owner: query.owner,
      env: query.env
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
    const { items, total } = deps.healthService.listChecks(resourceId, limit, offset);
    reply.send({ items, paging: { limit, offset, total } });
  });

  app.get(`${base}/checks/:check_id`, async (request, reply) => {
    const checkId = (request.params as { check_id: string }).check_id;
    const check = deps.healthService.getCheck(checkId);
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
}
