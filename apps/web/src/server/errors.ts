import type { ApiErrorCode } from '@vogn/types';
import type { ZodError } from 'zod';

const STATUS: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  ONBOARDING_REQUIRED: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  CONFIG_MISSING: 503,
  PROVIDER_ERROR: 502,
  ACCOUNT_SUSPENDED: 403,
  GONE: 410,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: unknown;
  readonly headers: Record<string, string>;

  constructor(code: ApiErrorCode, message: string, details?: unknown, headers: Record<string, string> = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
    this.headers = headers;
  }
}

export const unauthenticated = (message = 'Sign in required.') => new AppError('UNAUTHENTICATED', message);
export const forbidden = (message = 'You do not have permission to do that.') => new AppError('FORBIDDEN', message);
/** Used for both "missing" and "not visible to you" so resource existence never leaks. */
export const notFound = (what = 'Resource') => new AppError('NOT_FOUND', `${what} not found.`);
export const conflict = (message: string, details?: unknown) => new AppError('CONFLICT', message, details);
export const badRequest = (message: string, fieldErrors?: Record<string, string>) =>
  new AppError('VALIDATION_FAILED', message, fieldErrors ? { fieldErrors } : undefined);
export const configMissing = (integration: string, missing: string[]) =>
  new AppError('CONFIG_MISSING', `${integration} is not configured on this server.`, { integration, missing });
export const providerError = (provider: string, message = 'The provider did not respond.') =>
  new AppError('PROVIDER_ERROR', `${provider}: ${message}`, { provider });
export const rateLimited = (retryAfterSeconds: number) =>
  new AppError('RATE_LIMITED', 'Too many requests.', { retryAfterSeconds }, { 'Retry-After': String(retryAfterSeconds) });

export function fieldErrorsFromZod(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function validationError(error: ZodError): AppError {
  return new AppError('VALIDATION_FAILED', 'Request validation failed.', { fieldErrors: fieldErrorsFromZod(error) });
}
