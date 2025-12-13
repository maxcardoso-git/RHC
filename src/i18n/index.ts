import { DEFAULT_LOCALE } from '../domain/catalog.js';
import { Locale } from '../domain/types.js';

export type LocalizedString = Record<Locale, string>;

export function pickLocale<T extends string | LocalizedString>(
  locale: Locale | undefined,
  value: T
): string {
  if (typeof value === 'string') return value;
  const chosen = value[(locale as Locale) || DEFAULT_LOCALE];
  return chosen || value[DEFAULT_LOCALE] || Object.values(value)[0];
}

export const i18nMessages = {
  statusUp: {
    'pt-BR': 'Recurso operacional',
    'en-US': 'Resource is healthy',
    'es-ES': 'Recurso operativo'
  },
  statusDegraded: {
    'pt-BR': 'Recurso degradado',
    'en-US': 'Resource degraded',
    'es-ES': 'Recurso degradado'
  },
  statusDown: {
    'pt-BR': 'Recurso indisponível',
    'en-US': 'Resource unavailable',
    'es-ES': 'Recurso indisponible'
  }
} satisfies Record<string, LocalizedString>;
