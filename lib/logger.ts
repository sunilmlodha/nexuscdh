/**
 * Structured logging — emits one JSON object per line so Vercel/any log drain
 * can parse it (level, ts, msg + arbitrary fields). Replaces scattered
 * console.error with a consistent, queryable shape.
 *
 *   log.info('decision.served', { tenantId, customerId, latencyMs });
 *   log.error('strategy.upsert_failed', { tenantId, err: e });
 */
type Level = 'debug' | 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

function emit(level: Level, event: string, fields: Fields = {}) {
  const rec: Fields = { level, event, ts: new Date().toISOString(), ...sanitize(fields) };
  const line = JSON.stringify(rec);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

// Errors don't JSON.stringify usefully — flatten to message/name.
function sanitize(fields: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = v instanceof Error ? { name: v.name, message: v.message } : v;
  }
  return out;
}

export const log = {
  debug: (event: string, fields?: Fields) => emit('debug', event, fields),
  info:  (event: string, fields?: Fields) => emit('info', event, fields),
  warn:  (event: string, fields?: Fields) => emit('warn', event, fields),
  error: (event: string, fields?: Fields) => emit('error', event, fields),
};

/** Time an async operation and log its latency + outcome. */
export async function timed<T>(event: string, fields: Fields, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    log.info(event, { ...fields, ok: true, latencyMs: Date.now() - start });
    return result;
  } catch (e) {
    log.error(event, { ...fields, ok: false, latencyMs: Date.now() - start, err: e });
    throw e;
  }
}
