import { AppConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { IHealthStore } from './store-interface.js';
import { MemoryStore, memoryStore } from './memory-store.js';
import { PostgresStore } from './postgres-store.js';

let storeInstance: IHealthStore | null = null;
let postgresStoreInstance: PostgresStore | null = null;

/**
 * Creates and initializes the appropriate store based on configuration
 * - If DATABASE_URL is set, returns PostgresStore
 * - Otherwise, returns MemoryStore
 */
export async function createStore(config: AppConfig): Promise<IHealthStore> {
  if (storeInstance) {
    return storeInstance;
  }

  if (config.database.usePostgres && config.database.url) {
    logger.info('Initializing PostgresStore');

    const pgStore = new PostgresStore(config.database.url, config.database.enableCache);

    try {
      await pgStore.connect();
      postgresStoreInstance = pgStore;
      storeInstance = pgStore;

      logger.info({ enableCache: config.database.enableCache }, 'PostgresStore initialized successfully');
    } catch (err) {
      logger.error({ err }, 'Failed to initialize PostgresStore, falling back to MemoryStore');
      storeInstance = memoryStore;
    }
  } else {
    logger.info('Using MemoryStore (no DATABASE_URL configured)');
    storeInstance = memoryStore;
  }

  return storeInstance;
}

/**
 * Get the current store instance
 * Throws if store has not been initialized yet
 */
export function getStore(): IHealthStore {
  if (!storeInstance) {
    throw new Error('Store not initialized. Call createStore() first.');
  }
  return storeInstance;
}

/**
 * Close the store connection (useful for PostgresStore)
 */
export async function closeStore(): Promise<void> {
  if (postgresStoreInstance) {
    await postgresStoreInstance.close();
    postgresStoreInstance = null;
  }
  storeInstance = null;
}

/**
 * Check if PostgresStore is being used
 */
export function isUsingPostgres(): boolean {
  return storeInstance instanceof PostgresStore;
}
