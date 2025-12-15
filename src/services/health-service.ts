import { v4 as uuid } from 'uuid';
import { runCollector } from '../collectors/index.js';
import { evaluateRules } from '../rules/rule-engine.js';
import { getStore } from '../stores/store-factory.js';
import { i18nMessages } from '../i18n/index.js';
import {
  ExecutionType,
  HealthPolicy,
  HealthStatus,
  ResourceHealthCheck,
  ResourceHealthStatus,
  ResourceDescriptor
} from '../domain/types.js';
import { logger } from '../utils/logger.js';
import { CatalogService } from './catalog-service.js';
import { URL } from 'url';

export class HealthService {
  constructor(private catalog: CatalogService) {}

  async runCheck(
    resourceId: string,
    executionType: ExecutionType,
    resourceOverride?: ResourceDescriptor
  ): Promise<ResourceHealthCheck> {
    const store = getStore();
    const resource = resourceOverride || this.catalog.get(resourceId);
    if (!resource) {
      throw new Error('RESOURCE_NOT_FOUND');
    }
    await store.upsertResource(resource);
    const policy = resource.policy;
    if (!policy || !policy.enabled) {
      throw new Error('POLICY_DISABLED');
    }

    const startedAt = Date.now();
    let metrics: Record<string, import('../domain/types.js').MetricValue> = {};
    let finalStatus: HealthStatus = 'DEGRADED';
    let errorMessage: string | undefined;
    let ruleFailed: string[] = [];

    try {
      const collectorResult = await runCollector(resource);
      metrics = collectorResult.metrics;
      const { evaluations, finalStatus: status, failedRules } = evaluateRules(metrics, policy.rules);
      finalStatus = status;
      ruleFailed = failedRules;

      const check: ResourceHealthCheck = {
        id: uuid(),
        resource_id: resourceId,
        executed_at: new Date().toISOString(),
        execution_type: executionType,
        final_status: finalStatus,
        duration_ms: Date.now() - startedAt,
        metrics,
        rule_evaluations: evaluations,
        collector_debug: collectorResult.debug
      };

      await store.addCheck(check);
      await this.persistStatusFromCheck(resourceId, policy, resource, check, ruleFailed);
      return check;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Unknown collector error';
      const check: ResourceHealthCheck = {
        id: uuid(),
        resource_id: resourceId,
        executed_at: new Date().toISOString(),
        execution_type: executionType,
        final_status: 'DOWN',
        duration_ms: Date.now() - startedAt,
        metrics,
        rule_evaluations: {},
        error_message: errorMessage
      };
      await store.addCheck(check);
      await this.persistStatusFromCheck(resourceId, policy, resource, check, ruleFailed);
      logger.error({ err, resourceId }, 'collector failed');
      return check;
    }
  }

  private async persistStatusFromCheck(
    resourceId: string,
    policy: HealthPolicy,
    resource: ResourceDescriptor,
    check: ResourceHealthCheck,
    failedRules: string[]
  ) {
    const store = getStore();
    const existing = await store.getStatus(resourceId);
    const nextFailures = check.final_status === 'UP' ? 0 : (existing?.consecutive_failures || 0) + 1;
    const summaryMessage = this.getSummaryMessage(check.final_status);
    const summary = {
      message: summaryMessage,
      primary_cause: failedRules.length ? failedRules[0] : undefined,
      failed_rules: failedRules,
      key_metrics: Object.fromEntries(Object.entries(check.metrics || {}).slice(0, 3))
    };

    const status: ResourceHealthStatus = {
      resource_id: resourceId,
      resource_name: resource.name,
      resource_type: resource.type,
      resource_subtype: resource.subtype,
      env: resource.env,
      current_status: check.final_status,
      last_check_at: check.executed_at,
      last_success_at: check.final_status === 'UP' ? check.executed_at : existing?.last_success_at,
      consecutive_failures: nextFailures,
      summary: {
        ...summary,
        runtime_dependencies: this.buildRuntimeDependencies(check.metrics),
        connection_info: this.buildConnectionInfo(resource)
      }
    };

    if (check.final_status === 'UP') {
      await store.resetFailures(resourceId);
    } else {
      await store.incrementFailures(resourceId);
    }
    await store.upsertStatus(status);
  }

  private getSummaryMessage(status: HealthStatus) {
    switch (status) {
      case 'UP':
        return i18nMessages.statusUp;
      case 'DEGRADED':
        return i18nMessages.statusDegraded;
      case 'DOWN':
        return i18nMessages.statusDown;
      default:
        return i18nMessages.statusDown;
    }
  }

  listStatus(filters?: {
    type?: string;
    subtype?: string;
    status?: HealthStatus;
    tag?: string;
    owner?: string;
    env?: string;
  }) {
    const store = getStore();
    return store.listStatus(filters);
  }

  getStatus(resourceId: string) {
    const store = getStore();
    return store.getStatus(resourceId);
  }

  listChecks(resourceId: string, limit: number, offset: number) {
    const store = getStore();
    return store.listChecks(resourceId, limit, offset);
  }

  getCheck(checkId: string) {
    const store = getStore();
    return store.getCheck(checkId);
  }

  private buildRuntimeDependencies(metrics: Record<string, import('../domain/types.js').MetricValue>) {
    if (!metrics) return undefined;
    const prismaConnectionOk = metrics.prisma_connection_ok as boolean | undefined;
    const prismaPoolExhausted = metrics.prisma_pool_exhausted as boolean | undefined;
    const p95 = metrics.prisma_query_latency_ms_p95 as number | undefined;
    const errorRate = metrics.prisma_error_rate_pct_5m as number | undefined;
    const prismaStatus: HealthStatus =
      prismaConnectionOk === false
        ? 'DOWN'
        : prismaPoolExhausted
        ? 'DEGRADED'
        : p95 !== undefined && p95 !== null && p95 > 1000
        ? 'DEGRADED'
        : errorRate !== undefined && errorRate !== null && errorRate > 2
        ? 'DEGRADED'
        : 'UP';

    if (
      prismaConnectionOk === undefined &&
      prismaPoolExhausted === undefined &&
      p95 === undefined &&
      errorRate === undefined
    ) {
      return undefined;
    }

    return {
      prisma: {
        status: prismaStatus,
        connection_ok: prismaConnectionOk,
        pool_exhausted: prismaPoolExhausted,
        latency_p95_ms: p95 ?? null,
        latency_avg_ms: (metrics.prisma_query_latency_ms_avg as number | undefined) ?? null,
        error_rate_pct_5m: errorRate ?? null,
        last_error_code: (metrics.prisma_last_error_code as string | undefined) ?? null
      }
    };
  }

  private buildConnectionInfo(resource: ResourceDescriptor) {
    const endpoint = (resource.connection as any)?.endpoint as string | undefined;
    if (!endpoint) return undefined;
    try {
      const url = new URL(endpoint);
      url.username = '';
      url.password = '';
      const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
      return {
        endpoint: url.toString(),
        port
      };
    } catch {
      return { endpoint };
    }
  }
}
