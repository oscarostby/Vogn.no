import type { ApiErrorBody, ApiErrorCode, ApiSuccessBody } from '@vogn/types';

export class ApiError extends Error {
  readonly code: ApiErrorCode | 'NETWORK';
  readonly status: number;
  readonly details: unknown;
  readonly requestId: string | undefined;

  constructor(code: ApiErrorCode | 'NETWORK', message: string, status: number, details?: unknown, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }

  /** Field errors from VALIDATION_FAILED responses: `{ "field.path": "validation.key" }`. */
  get fieldErrors(): Record<string, string> {
    const d = this.details as { fieldErrors?: Record<string, string> } | undefined;
    return d?.fieldErrors ?? {};
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[];

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface ApiClientOptions {
  /** Origin of the VOGN web deployment, e.g. https://vogn.no. Empty string for same-origin (web). */
  baseUrl: string;
  /** Returns a Clerk session token for Bearer auth (mobile). Web uses cookies and can omit this. */
  getToken?: () => Promise<string | null>;
  fetch?: typeof fetch;
  /** Sent as Accept-Language. */
  getLocale?: () => string | undefined;
  onUnauthenticated?: () => void;
}

export interface ApiResponse<T> {
  data: T;
  meta: ApiSuccessBody<T>['meta'];
}

function buildQuery(query: Record<string, QueryValue> | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
    else params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export function createHttp(options: ApiClientOptions) {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);

  async function request<T>(method: HttpMethod, path: string, init: RequestOptions = {}): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { Accept: 'application/json', ...init.headers };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    const locale = options.getLocale?.();
    if (locale) headers['Accept-Language'] = locale;
    if (options.getToken) {
      const token = await options.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await doFetch(`${options.baseUrl}/api/v1${path}${buildQuery(init.query)}`, {
        method,
        headers,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: init.signal,
        credentials: options.baseUrl ? 'omit' : 'same-origin',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      throw new ApiError('NETWORK', 'Network request failed', 0);
    }

    const requestId = response.headers.get('x-request-id') ?? undefined;
    let json: unknown = null;
    if (response.status !== 204) {
      try {
        json = await response.json();
      } catch {
        json = null;
      }
    }

    if (!response.ok) {
      const body = json as ApiErrorBody | null;
      const code = body?.error?.code ?? (response.status === 401 ? 'UNAUTHENTICATED' : 'INTERNAL');
      if (code === 'UNAUTHENTICATED') options.onUnauthenticated?.();
      throw new ApiError(code, body?.error?.message ?? response.statusText, response.status, body?.error?.details, requestId);
    }

    const body = (json ?? { data: null }) as ApiSuccessBody<T>;
    return { data: body.data, meta: body.meta };
  }

  return {
    request,
    get: <T>(path: string, init?: RequestOptions) => request<T>('GET', path, init).then((r) => r.data),
    getWithMeta: <T>(path: string, init?: RequestOptions) => request<T>('GET', path, init),
    post: <T>(path: string, body?: unknown, init?: RequestOptions) => request<T>('POST', path, { ...init, body: body ?? {} }).then((r) => r.data),
    patch: <T>(path: string, body: unknown, init?: RequestOptions) => request<T>('PATCH', path, { ...init, body }).then((r) => r.data),
    put: <T>(path: string, body: unknown, init?: RequestOptions) => request<T>('PUT', path, { ...init, body }).then((r) => r.data),
    del: <T>(path: string, body?: unknown, init?: RequestOptions) =>
      request<T>('DELETE', path, { ...init, ...(body !== undefined ? { body } : {}) }).then((r) => r.data),
  };
}

export type Http = ReturnType<typeof createHttp>;
