import { v4 as uuid } from 'uuid';
import { runCollector } from '../collectors/index.js';
import { evaluateRules } from '../rules/rule-engine.js';
import { memoryStore } from '../stores/memory-store.js';
import { pickLocale, i18nMessages } from '../i18n/index.js';
import {
  ExecutionType,
  HealthPolicy,
  HealthStatus,
  ResourceHealthCheck,
  ResourceHealthStatus
} from '../domain/types.js';
import { logger } from '../utils/logger.js';

export class HealthService {
  async runCheck(resourceId: string, executionType: ExecutionType): Promise<ResourceHealthCheck> {
    const resource = memoryStore.getResource(resourceId);
    if (!resource) {
      throw new Error('RESOURCE_NOT_FOUND');
    }
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

      memoryStore.addCheck(check);
      this.persistStatusFromCheck(resourceId, policy, check, ruleFailed);
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
      memoryStore.addCheck(check);
      this.persistStatusFromCheck(resourceId, policy, check, ruleFailed);
      logger.error({ err, resourceId }, 'collector failed');
      return check;
    }
  }

  private persistStatusFromCheck(resourceId: string, policy: HealthPolicy, check: ResourceHealthCheck, failedRules: string[]) {
    const existing = memoryStore.getStatus(resourceId);
    const nextFailures = check.final_status === 'UP' ? 0 : (existing?.consecutive_failures || 0) + 1;
    const summaryMessage = this.getSummaryMessage(check.final_status);
    const summary = {
      message: summaryMessage,
      primary_cause: failedRules.length ? failedRules[0] : undefined,
      failed_rules: failedRules,
      key_metrics: Object.fromEntries(
        Object.entries(check.metrics || {}).slice(0, 3) // keep short preview
      )
    };

    const status: ResourceHealthStatus = {
      resource_id: resourceId,
      resource_type: memoryStore.getResource(resourceId)!.type,
      resource_subtype: memoryStore.getResource(resourceId)!.subtype,
      current_status: check.final_status,
      last_check_at: check.executed_at,
      last_success_at: check.final_status === 'UP' ? check.executed_at : existing?.last_success_at,
      consecutive_failures: nextFailures,
      summary
    };

    if (check.final_status === 'UP') {
      memoryStore.resetFailures(resourceId);
    } else {
      memoryStore.incrementFailures(resourceId);
    }
    memoryStore.upsertStatus(status);
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

  listStatus(filters?: Parameters<typeof memoryStore.listStatus>[0]) {
    return memoryStore.listStatus(filters);
  }

  getStatus(resourceId: string) {
    return memoryStore.getStatus(resourceId);
  }

  listChecks(resourceId: string, limit: number, offset: number) {
    return memoryStore.listChecks(resourceId, limit, offset);
  }

  getCheck(checkId: string) {
    return memoryStore.getCheck(checkId);
  }
}

export const healthService = new HealthService();
