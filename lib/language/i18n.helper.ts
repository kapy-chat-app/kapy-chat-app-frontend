import { TranslationKeys, TranslationKey } from '@/types/i18n';

/**
 * Get nested value from object using dot notation
 * Example: get(obj, 'settings.account.title') => obj.settings.account.title
 */
export function getNestedValue(
  obj: any,
  path: string
): string {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return path; // Return key if not found
    }
  }

  return typeof current === 'string' ? current : path;
}

/**
 * Replace interpolation variables in string
 * Example: "Hello, {{name}}!" with {name: "John"} => "Hello, John!"
 */
export function interpolate(
  text: string,
  variables?: Record<string, string | number>
): string {
  if (!variables) return text;

  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variables[key]?.toString() || '';
  });
}