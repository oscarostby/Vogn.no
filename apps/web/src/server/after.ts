import 'server-only';
import { after } from 'next/server';
import { log } from './log';

/**
 * Runs non-critical work (push delivery, cleanup) after the response is sent. Falls back to a detached
 * promise outside a request scope (scripts, tests).
 */
export function runAfterResponse(task: () => Promise<void>): void {
  const wrapped = async () => {
    try {
      await task();
    } catch (error) {
      log.warn('background task failed', { error });
    }
  };
  try {
    after(wrapped);
  } catch {
    void wrapped();
  }
}
