import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { ResourceDescriptor } from '../domain/types.js';
import { ResourceRegistryClient } from './resource-registry-client.js';
import { logger } from '../utils/logger.js';

type CatalogSource = 'registry_snapshot' | 'manual' | 'sync';

export interface CatalogEntry extends ResourceDescriptor {
  source: CatalogSource;
  synced_at?: string;
  updated_at?: string;
}

export class CatalogService {
  private cache: CatalogEntry[] = [];

  constructor(private filePath: string, private registryClient: ResourceRegistryClient) {
    this.ensureDir();
    this.load();
  }

  private ensureDir() {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private load() {
    if (!existsSync(this.filePath)) {
      this.cache = [];
      return;
    }
    try {
      const raw = readFileSync(this.filePath, 'utf-8');
      this.cache = JSON.parse(raw) as CatalogEntry[];
    } catch (err) {
      logger.error({ err }, 'failed to load catalog file, starting empty');
      this.cache = [];
    }
  }

  private persist() {
    const payload = JSON.stringify(this.cache, null, 2);
    writeFileSync(this.filePath, payload);
  }

  list(): CatalogEntry[] {
    return [...this.cache];
  }

  get(id: string): CatalogEntry | undefined {
    return this.cache.find((c) => c.id === id);
  }

  delete(id: string): boolean {
    const before = this.cache.length;
    this.cache = this.cache.filter((c) => c.id !== id);
    if (this.cache.length !== before) {
      this.persist();
      return true;
    }
    return false;
  }

  upsert(entry: Partial<CatalogEntry> & { id: string }, source: CatalogSource = 'manual') {
    const now = new Date().toISOString();
    const existingIdx = this.cache.findIndex((c) => c.id === entry.id);
    const merged: CatalogEntry = {
      id: entry.id,
      name: entry.name || (existingIdx >= 0 ? this.cache[existingIdx].name : 'unknown'),
      type: entry.type || (existingIdx >= 0 ? this.cache[existingIdx].type : 'http_service'),
      subtype: entry.subtype ?? (existingIdx >= 0 ? this.cache[existingIdx].subtype : undefined),
      enabled: entry.enabled ?? (existingIdx >= 0 ? this.cache[existingIdx].enabled : true),
      env: entry.env ?? (existingIdx >= 0 ? this.cache[existingIdx].env : undefined),
      tags: entry.tags ?? (existingIdx >= 0 ? this.cache[existingIdx].tags : []),
      connection: entry.connection ?? (existingIdx >= 0 ? this.cache[existingIdx].connection : undefined),
      config: entry.config ?? (existingIdx >= 0 ? this.cache[existingIdx].config : undefined),
      policy: entry.policy ?? (existingIdx >= 0 ? this.cache[existingIdx].policy : undefined),
      owner: entry.owner ?? (existingIdx >= 0 ? this.cache[existingIdx].owner : undefined),
      criticality: entry.criticality ?? (existingIdx >= 0 ? this.cache[existingIdx].criticality : undefined),
      source: source,
      synced_at: source === 'registry_snapshot' ? now : this.cache[existingIdx]?.synced_at,
      updated_at: now
    };
    if (existingIdx >= 0) {
      this.cache[existingIdx] = merged;
    } else {
      this.cache.push(merged);
    }
    this.persist();
    return merged;
  }

  async importFromRegistry(): Promise<{ imported: number }> {
    try {
      const resources = await this.registryClient.listResources(true);
      resources.forEach((res) => {
        this.upsert(
          {
            ...res,
            source: 'registry_snapshot'
          } as CatalogEntry,
          'registry_snapshot'
        );
      });
      logger.info({ count: resources.length }, 'catalog imported from registry');
      return { imported: resources.length };
    } catch (err) {
      logger.error({ err }, 'failed to import catalog from registry');
      throw err;
    }
  }

  ensureSeeded() {
    if (this.cache.length === 0) {
      return this.importFromRegistry().catch(() => ({ imported: 0 }));
    }
    return { imported: 0 };
  }
}
