import { AppConfig } from '../config/index.js';
import { memoryStore } from '../stores/memory-store.js';
import { HealthService } from '../services/health-service.js';
import { logger } from '../utils/logger.js';
import { ResourceRegistryClient } from '../services/resource-registry-client.js';

function parseIntervalSeconds(value: string): number {
  // Minimal ISO-8601 duration parser supporting minutes/seconds: PT10M, PT30S
  const minutesMatch = value.match(/PT(\d+)M/);
  const secondsMatch = value.match(/PT\d+M?(\d+)S/);
  const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
  const seconds = secondsMatch ? parseInt(secondsMatch[1], 10) : 0;
  return minutes * 60 + seconds || 600;
}

function jitter(maxSeconds: number): number {
  return Math.random() * maxSeconds;
}

export class Scheduler {
  private timer: NodeJS.Timeout | null = null;

  constructor(private cfg: AppConfig, private registryClient: ResourceRegistryClient, private healthService: HealthService) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.loop(), this.cfg.scheduler.loopIntervalSeconds * 1000);
    logger.info(
      { loopSeconds: this.cfg.scheduler.loopIntervalSeconds },
      'scheduler started'
    );
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async loop() {
    const resources = (await this.registryClient.listResources()).filter((r) => r.enabled && r.policy?.enabled);
    memoryStore.setResources(resources);
    for (const res of resources) {
      const policy = res.policy!;
      if (policy.schedule.type !== 'INTERVAL') continue;
      const intervalSeconds = parseIntervalSeconds(policy.schedule.value);
      const status = memoryStore.getStatus(res.id);
      const lastCheck = status?.last_check_at ? new Date(status.last_check_at).getTime() : 0;
      const now = Date.now();
      if (now - lastCheck < intervalSeconds * 1000 + jitter(this.cfg.scheduler.jitterMaxSeconds) * 1000) {
        continue;
      }
      try {
        await this.healthService.runCheck(res.id, 'SCHEDULED', res);
      } catch (err) {
        logger.error({ err, resourceId: res.id }, 'scheduled check failed');
      }
    }
  }
}
