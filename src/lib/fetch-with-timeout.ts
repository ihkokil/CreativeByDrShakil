export function fetchWithTimeout(ms = 8000) {
  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  };
}
