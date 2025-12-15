import {
  HealthStatus,
  ResourceDescriptor,
  ResourceHealthCheck,
  ResourceHealthStatus
} from '../domain/types.js';

/**
 * Common interface for all store implementations
 * This ensures compatibility between MemoryStore and PostgresStore
 */
export interface IHealthStore {
  // Resources (Catalog)
  setResources(resources: ResourceDescriptor[]): void | Promise<void>;
  listResources(): ResourceDescriptor[] | Promise<ResourceDescriptor[]>;
  upsertResource(resource: ResourceDescriptor): void | Promise<void>;
  getResource(id: string): ResourceDescriptor | undefined | Promise<ResourceDescriptor | undefined>;
  removeResource(resourceId: string): void | Promise<void>;

  // Health Status
  upsertStatus(status: ResourceHealthStatus): void | Promise<void>;
  getStatus(resourceId: string): ResourceHealthStatus | undefined | Promise<ResourceHealthStatus | undefined>;
  listStatus(filters?: {
    type?: string;
    subtype?: string;
    status?: HealthStatus;
    tag?: string;
    owner?: string;
    env?: string;
  }): ResourceHealthStatus[] | Promise<ResourceHealthStatus[]>;
  incrementFailures(resourceId: string): void | Promise<void>;
  resetFailures(resourceId: string): void | Promise<void>;

  // Health Checks (History)
  addCheck(check: ResourceHealthCheck): void | Promise<void>;
  listChecks(resourceId: string, limit?: number, offset?: number): { items: ResourceHealthCheck[]; total: number } | Promise<{ items: ResourceHealthCheck[]; total: number }>;
  getCheck(checkId: string): ResourceHealthCheck | undefined | Promise<ResourceHealthCheck | undefined>;
}
