import { randomBytes } from 'node:crypto';

export function createUniqueSlug(value: string): string {
  const base = normalizeSlug(value);
  const suffix = randomBytes(4).toString('hex');
  return `${base || 'business'}-${suffix}`;
}

export function normalizeSlug(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[ʻ’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 160);
}
