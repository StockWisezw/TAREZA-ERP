export class QueryCache {
  private static instance: QueryCache;
  private cache = new Map<string, { data: any; timestamp: number }>();

  private constructor() {}

  public static getInstance(): QueryCache {
    if (!QueryCache.instance) {
      QueryCache.instance = new QueryCache();
    }
    return QueryCache.instance;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  isStale(key: string, staleTimeMs: number = 30000): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;
    return Date.now() - entry.timestamp > staleTimeMs;
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export const queryCache = QueryCache.getInstance();

// Custom hook helper for deduplicated operations in components
import { useState, useEffect } from 'react';

export function useCachedQuery<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options?: { staleTime?: number; enabled?: boolean }
) {
  const [data, setData] = useState<T | null>(() => queryCache.get<T>(cacheKey));
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(!queryCache.get<T>(cacheKey));

  const staleTime = options?.staleTime ?? 30000;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;

    const cachedVal = queryCache.get<T>(cacheKey);
    const isStale = queryCache.isStale(cacheKey, staleTime);

    if (cachedVal && !isStale) {
      setData(cachedVal);
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function execute() {
      try {
        if (!cachedVal) setLoading(true);
        const freshData = await fetchFn();
        queryCache.set(cacheKey, freshData);
        if (isMounted) {
          setData(freshData);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    execute();

    return () => {
      isMounted = false;
    };
  }, [cacheKey, enabled, staleTime]);

  const invalidate = () => {
    queryCache.invalidate(cacheKey);
  };

  return { data, error, loading, invalidate };
}
