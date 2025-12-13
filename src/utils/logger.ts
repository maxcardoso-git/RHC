import pino from 'pino';
import { loadConfig } from '../config/index.js';

const cfg = loadConfig();

export const logger = pino({
  name: cfg.serviceName,
  level: cfg.logging.level,
  base: undefined,
  transport:
    cfg.env === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', singleLine: true }
        }
      : undefined
});
