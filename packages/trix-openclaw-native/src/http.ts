const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const signal = init.signal
    ? (typeof AbortSignal.any === 'function'
      ? AbortSignal.any([init.signal, controller.signal])
      : controller.signal)
    : controller.signal;

  try {
    return await fetch(input, {
      ...init,
      signal,
    });
  } catch (error) {
    const abortedByTimeout = controller.signal.aborted && !(init.signal?.aborted ?? false);
    if (abortedByTimeout) {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${input}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
