import 'server-only';

type Level = 'debug' | 'info' | 'warn' | 'error';

const SECRET_KEYS = /(secret|token|password|authorization|cookie|key|signature|vin|registration)/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[depth]';
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: process.env.NODE_ENV === 'production' ? undefined : value.stack };
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEYS.test(k) ? '[redacted]' : scrub(v, depth + 1)]),
    );
  }
  return value;
}

function emit(level: Level, message: string, meta?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'test' && level !== 'error' && !process.env.DEBUG_LOGS) return;
  const line = JSON.stringify({ level, message, time: new Date().toISOString(), ...(meta ? (scrub(meta) as object) : {}) });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

/** Structured JSON logs (Vercel log drains / any log platform). Secrets are redacted by key name. */
export const log = {
  debug: (message: string, meta?: Record<string, unknown>) => emit('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => emit('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit('error', message, meta),
};
