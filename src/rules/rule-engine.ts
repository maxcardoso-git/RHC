import { MetricValue, RuleDefinition, RuleEvaluationResult, HealthStatus } from '../domain/types.js';

function evaluateOperator(operator: RuleDefinition['operator'], observed: MetricValue, threshold?: MetricValue): boolean {
  switch (operator) {
    case '<':
      return typeof observed === 'number' && typeof threshold === 'number' && observed < threshold;
    case '<=':
      return typeof observed === 'number' && typeof threshold === 'number' && observed <= threshold;
    case '>':
      return typeof observed === 'number' && typeof threshold === 'number' && observed > threshold;
    case '>=':
      return typeof observed === 'number' && typeof threshold === 'number' && observed >= threshold;
    case '==':
      return observed === threshold;
    case '!=':
      return observed !== threshold;
    case 'in':
      return Array.isArray(threshold) ? threshold.includes(observed as never) : false;
    case 'not_in':
      return Array.isArray(threshold) ? !threshold.includes(observed as never) : false;
    case 'regex':
      return typeof observed === 'string' && typeof threshold === 'string' && new RegExp(threshold).test(observed);
    case 'exists':
      return observed !== undefined && observed !== null;
    default:
      return false;
  }
}

function pickWorstStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes('DOWN')) return 'DOWN';
  if (statuses.includes('DEGRADED')) return 'DEGRADED';
  return 'UP';
}

export function evaluateRules(
  metrics: Record<string, MetricValue>,
  rules: RuleDefinition[]
): { evaluations: Record<string, RuleEvaluationResult>; finalStatus: HealthStatus; failedRules: string[] } {
  const evaluations: Record<string, RuleEvaluationResult> = {};
  const failedStatuses: HealthStatus[] = [];
  const failedRules: string[] = [];

  // If no rules defined, default to UP if availability is true, DOWN otherwise
  if (!rules || rules.length === 0) {
    const availability = metrics.availability;
    const finalStatus: HealthStatus = availability === true ? 'UP' : 'DOWN';
    return { evaluations, finalStatus, failedRules };
  }

  rules.forEach((rule) => {
    const observed = metrics[rule.metric];
    const passed = evaluateOperator(rule.operator, observed, rule.threshold);
    const evaluation: RuleEvaluationResult = {
      rule_id: rule.rule_id,
      metric: rule.metric,
      observed,
      operator: rule.operator,
      threshold: rule.threshold,
      passed,
      severity: rule.severity,
      statusOnFail: rule.onFailStatus
    };
    evaluations[rule.rule_id] = evaluation;
    if (!passed) {
      failedRules.push(rule.rule_id);
      failedStatuses.push(rule.onFailStatus);
    }
  });

  const finalStatus = pickWorstStatus(failedStatuses.length ? failedStatuses : ['UP']);
  return { evaluations, finalStatus, failedRules };
}
