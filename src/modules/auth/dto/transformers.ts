import type { TransformFnParams } from 'class-transformer';

export function normalizeEmail(params: TransformFnParams): unknown {
  const value: unknown = params.value as unknown;
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
