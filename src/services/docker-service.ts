import Docker from 'dockerode';
import { RestartConfig } from '../domain/types.js';
import { logger } from '../utils/logger.js';

export interface RestartResult {
  success: boolean;
  container_name: string;
  message: string;
  duration_ms: number;
}

export class DockerService {
  private docker: Docker | null = null;
  private enabled: boolean = false;

  constructor() {
    // Try to connect to Docker socket
    try {
      this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
      this.enabled = true;
      logger.info('DockerService initialized with socket connection');
    } catch (err) {
      this.enabled = false;
      this.docker = null;
      logger.warn('DockerService: Docker socket not available, restart functionality disabled');
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.enabled || !this.docker) return false;
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  async restartContainer(config: RestartConfig): Promise<RestartResult> {
    const start = Date.now();
    const containerName = config.container_name || '';

    if (!this.enabled || !this.docker) {
      return {
        success: false,
        container_name: containerName,
        message: 'Docker socket not available',
        duration_ms: Date.now() - start
      };
    }

    if (config.type !== 'docker') {
      return {
        success: false,
        container_name: containerName,
        message: `Restart type '${config.type}' not supported yet`,
        duration_ms: Date.now() - start
      };
    }

    if (!containerName) {
      return {
        success: false,
        container_name: '',
        message: 'Container name not configured',
        duration_ms: Date.now() - start
      };
    }

    try {
      logger.info({ container: containerName }, 'Restarting container');

      const container = this.docker.getContainer(containerName);

      // Check if container exists
      const info = await container.inspect();
      const wasRunning = info.State.Running;

      // Restart the container (timeout 10 seconds)
      await container.restart({ t: 10 });

      const duration = Date.now() - start;
      logger.info({ container: containerName, duration_ms: duration, wasRunning }, 'Container restarted successfully');

      return {
        success: true,
        container_name: containerName,
        message: `Container '${containerName}' restarted successfully`,
        duration_ms: duration
      };
    } catch (err: any) {
      const duration = Date.now() - start;
      const message = err?.message || 'Unknown error';

      logger.error({ container: containerName, error: message }, 'Failed to restart container');

      return {
        success: false,
        container_name: containerName,
        message: `Failed to restart: ${message}`,
        duration_ms: duration
      };
    }
  }

  async listContainers(): Promise<{ id: string; name: string; state: string; status: string }[]> {
    if (!this.enabled || !this.docker) return [];

    try {
      const containers = await this.docker.listContainers({ all: true });
      return containers.map(c => ({
        id: c.Id.substring(0, 12),
        name: c.Names[0]?.replace(/^\//, '') || '',
        state: c.State,
        status: c.Status
      }));
    } catch {
      return [];
    }
  }
}

// Singleton instance
export const dockerService = new DockerService();
