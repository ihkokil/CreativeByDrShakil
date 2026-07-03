/**
 * KV Cache utility for Cloudflare Workers Free Tier
 * Caches database query results in Workers KV to stay within 50ms CPU budget
 */

declare global {
  var DB_CACHE: KVNamespace;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds (default: 600s = 10 minutes)
  key: string; // Cache key
}

/**
 * Get cached value or fetch from source if not cached
 * @param options Cache options with key and optional TTL
 * @param fetcher Function that fetches the value if not cached
 * @returns Cached or fetched value
 */
export async function getCachedOrFetch<T>(
  options: CacheOptions,
  fetcher: () => Promise<T>
): Promise<T> {
  const { key, ttl = 600 } = options;


  try {
    // Try to get from cache
    if (typeof DB_CACHE !== 'undefined') {
      const cached = await DB_CACHE.get(key, 'json');
      if (cached) {
        return cached as T;
      }
    }
  } catch (error) {
    console.warn(`[KV Cache] Error reading cache key "${key}":`, error);
    // Fall through to fetch fresh data
  }

  // Not in cache, fetch fresh data
  const data = await fetcher();

  // Try to store in cache for future requests
  try {
    if (typeof DB_CACHE !== 'undefined') {
      await DB_CACHE.put(key, JSON.stringify(data), {
        expirationTtl: ttl,
      });
    }
  } catch (error) {
    console.warn(`[KV Cache] Error writing cache key "${key}":`, error);
    // If cache write fails, still return the data
  }

  return data;
}

/**
 * Clear a specific cache key
 */
export async function clearCache(key: string): Promise<void> {

  try {
    if (typeof DB_CACHE !== 'undefined') {
      await DB_CACHE.delete(key);
    }
  } catch (error) {
    console.warn(`[KV Cache] Error clearing cache key "${key}":`, error);
  }
}

/**
 * Clear multiple cache keys with pattern matching
 */
export async function clearCachePattern(pattern: string): Promise<void> {

  try {
    if (typeof DB_CACHE !== 'undefined') {
      const keys = await DB_CACHE.list({ prefix: pattern });
      for (const key of keys.keys) {
        await DB_CACHE.delete(key.name);
      }
    }
  } catch (error) {
    console.warn(`[KV Cache] Error clearing cache pattern "${pattern}":`, error);
  }
}
