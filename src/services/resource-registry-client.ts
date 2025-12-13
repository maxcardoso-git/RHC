import { AppConfig } from '../config/index.js';
import { ResourceDescriptor, HealthPolicy } from '../domain/types.js';
import { logger } from '../utils/logger.js';

interface RegistryResourceResponse extends ResourceDescriptor {
  policy?: HealthPolicy;
}

export class ResourceRegistryClient {
  private cache: { items: ResourceDescriptor[]; fetchedAt: number } | null = null;

  constructor(private cfg: AppConfig) {}

  private headers() {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.cfg.resourceRegistry.apiKey) {
      headers['X-Internal-Api-Key'] = this.cfg.resourceRegistry.apiKey;
    }
    return headers;
  }

  private baseUrl(): string {
    return this.cfg.resourceRegistry.baseUrl.replace(/\/$/, '');
  }

  async listResources(force = false): Promise<ResourceDescriptor[]> {
    if (!force && this.cache && Date.now() - this.cache.fetchedAt < this.cfg.resourceRegistry.cacheSeconds * 1000) {
      return this.cache.items;
    }
    const url = `${this.baseUrl()}/resource-registry/resources?enabled=true`;
    try {
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) {
        throw new Error(`registry response ${res.status}`);
      }
      const data = (await res.json()) as RegistryResourceResponse[];
      const withPolicies = await Promise.all(
        data.map(async (item) => {
          if (item.policy) return item;
          const policy = await this.getHealthPolicy(item.id);
          return { ...item, policy };
        })
      );
      this.cache = { items: withPolicies, fetchedAt: Date.now() };
      return withPolicies;
    } catch (err) {
      logger.error({ err, url }, 'failed to list resources from registry');
      return this.cache?.items || [];
    }
  }

  async getHealthPolicy(resourceId: string): Promise<HealthPolicy | undefined> {
    const url = `${this.baseUrl()}/resource-registry/resources/${resourceId}/health-policy`;
    try {
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) {
        logger.warn({ resourceId, status: res.status }, 'policy fetch returned non-200');
        return undefined;
      }
      return (await res.json()) as HealthPolicy;
    } catch (err) {
      logger.error({ err, resourceId }, 'failed to fetch health policy');
      return undefined;
    }
  }

  async getResource(resourceId: string): Promise<ResourceDescriptor | undefined> {
    const list = await this.listResources();
    const found = list.find((r) => r.id === resourceId);
    if (found) return found;
    try {
      const url = `${this.baseUrl()}/resource-registry/resources/${resourceId}`;
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) return undefined;
      const item = (await res.json()) as RegistryResourceResponse;
      if (!item.policy) {
        item.policy = await this.getHealthPolicy(resourceId);
      }
      return item;
    } catch (err) {
      logger.error({ err, resourceId }, 'failed to fetch resource directly');
      return undefined;
    }
  }
}
