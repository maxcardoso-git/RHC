import {
  HealthStatus,
  ResourceDescriptor,
  ResourceHealthCheck,
  ResourceHealthStatus
} from '../domain/types.js';
import { IHealthStore } from './store-interface.js';

export class MemoryStore implements IHealthStore {
  private resources = new Map<string, ResourceDescriptor>();
  private status = new Map<string, ResourceHealthStatus>();
  private checks: ResourceHealthCheck[] = [];

  constructor() {}

  setResources(resources: ResourceDescriptor[]): void {
    this.resources.clear();
    resources.forEach((res) => this.resources.set(res.id, res));
  }

  listResources(): ResourceDescriptor[] {
    return Array.from(this.resources.values());
  }

  upsertResource(resource: ResourceDescriptor): void {
    this.resources.set(resource.id, resource);
  }

  getResource(id: string): ResourceDescriptor | undefined {
    return this.resources.get(id);
  }

  upsertStatus(status: ResourceHealthStatus): void {
    this.status.set(status.resource_id, {
      ...status,
      updated_at: new Date().toISOString()
    });
  }

  getStatus(resourceId: string): ResourceHealthStatus | undefined {
    return this.status.get(resourceId);
  }

  listStatus(filters?: {
    type?: string;
    subtype?: string;
    status?: HealthStatus;
    tag?: string;
    owner?: string;
    env?: string;
  }): ResourceHealthStatus[] {
    let items = Array.from(this.status.values());
    if (filters?.type) {
      items = items.filter((s) => s.resource_type === filters.type);
    }
    if (filters?.subtype) {
      items = items.filter((s) => s.resource_subtype === filters.subtype);
    }
    if (filters?.status) {
      items = items.filter((s) => s.current_status === filters.status);
    }
    if (filters?.tag) {
      items = items.filter((s) => this.resources.get(s.resource_id)?.tags?.includes(filters.tag!));
    }
    if (filters?.owner) {
      items = items.filter((s) => this.resources.get(s.resource_id)?.owner === filters.owner);
    }
    if (filters?.env) {
      items = items.filter((s) => this.resources.get(s.resource_id)?.env === filters.env);
    }
    return items;
  }

  addCheck(check: ResourceHealthCheck): void {
    this.checks.unshift(check);
    if (this.checks.length > 5000) {
      this.checks.pop();
    }
  }

  listChecks(resourceId: string, limit = 20, offset = 0): { items: ResourceHealthCheck[]; total: number } {
    const items = this.checks.filter((c) => c.resource_id === resourceId);
    return { items: items.slice(offset, offset + limit), total: items.length };
  }

  getCheck(checkId: string): ResourceHealthCheck | undefined {
    return this.checks.find((c) => c.id === checkId);
  }

  incrementFailures(resourceId: string): void {
    const st = this.status.get(resourceId);
    if (st) {
      this.status.set(resourceId, { ...st, consecutive_failures: st.consecutive_failures + 1 });
    }
  }

  resetFailures(resourceId: string): void {
    const st = this.status.get(resourceId);
    if (st) {
      this.status.set(resourceId, { ...st, consecutive_failures: 0 });
    }
  }

  removeResource(resourceId: string): void {
    this.resources.delete(resourceId);
    this.status.delete(resourceId);
    this.checks = this.checks.filter((c) => c.resource_id !== resourceId);
  }
}

export const memoryStore = new MemoryStore();
