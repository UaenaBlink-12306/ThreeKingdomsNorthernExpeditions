import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { reportConsoleError } from "../utils/errorLogger";

type QueryKey = readonly unknown[];

interface QueryState<T> {
  data?: T;
  error?: unknown;
  updatedAt: number;
}

interface QueryOptions<T> {
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
  enabled?: boolean;
  retry?: number;
  retryDelay?: (attemptIndex: number) => number;
  staleTime?: number;
}

interface MutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  retry?: boolean;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: unknown) => void;
}

export class QueryClient {
  private store = new Map<string, QueryState<unknown>>();
  private listeners = new Map<string, Set<() => void>>();
  defaultOptions?: {
    queries?: { retry?: number; retryDelay?: (attemptIndex: number) => number };
    mutations?: { retry?: boolean };
  };

  constructor(config?: { defaultOptions?: QueryClient["defaultOptions"] }) {
    this.defaultOptions = config?.defaultOptions;
  }

  private key(key: QueryKey) {
    return JSON.stringify(key);
  }

  getQueryData<T>(key: QueryKey): T | undefined {
    return this.store.get(this.key(key))?.data as T | undefined;
  }

  getQueryState(key: QueryKey) {
    return this.store.get(this.key(key));
  }

  setQueryData<T>(key: QueryKey, data: T) {
    const id = this.key(key);
    this.store.set(id, { data, updatedAt: Date.now() });
    this.listeners.get(id)?.forEach((cb) => cb());
  }

  subscribe(key: QueryKey, cb: () => void) {
    const id = this.key(key);
    const set = this.listeners.get(id) ?? new Set<() => void>();
    set.add(cb);
    this.listeners.set(id, set);
    return () => {
      set.delete(cb);
    };
  }

  async fetchQuery<T>(options: QueryOptions<T>): Promise<T> {
    const entry = this.getQueryState(options.queryKey);
    const staleTime = options.staleTime ?? 0;
    if (entry?.data !== undefined && Date.now() - entry.updatedAt <= staleTime) {
      return entry.data as T;
    }
    const data = await executeWithRetry(
      options.queryFn,
      options.retry ?? this.defaultOptions?.queries?.retry ?? 0,
      options.retryDelay ?? this.defaultOptions?.queries?.retryDelay
    );
    this.setQueryData(options.queryKey, data);
    return data;
  }
}

const QueryContext = createContext<QueryClient | null>(null);

export function QueryClientProvider({ client, children }: { client: QueryClient; children: React.ReactNode }) {
  return <QueryContext.Provider value={client}>{children}</QueryContext.Provider>;
}

export function useQueryClient() {
  const client = useContext(QueryContext);
  if (!client) {
    throw new Error("QueryClientProvider missing");
  }
  return client;
}

export function useQuery<T>(options: QueryOptions<T>) {
  const client = useQueryClient();
  const [data, setData] = useState<T | undefined>(() => client.getQueryData<T>(options.queryKey));
  const [error, setError] = useState<unknown>(undefined);
  const [isFetching, setIsFetching] = useState(false);

  // Store latest options in ref to avoid dependency issues
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Memoize queryKey string to avoid recreating subscription on every render
  const queryKeyStr = useMemo(() => JSON.stringify(options.queryKey), [options.queryKey]);
  
  useEffect(() => {
    return client.subscribe(options.queryKey, () => setData(client.getQueryData<T>(options.queryKey)));
  }, [client, queryKeyStr]);

  // Memoize enabled to avoid unnecessary re-fetches
  const enabled = options.enabled !== false;
  
  useEffect(() => {
    if (!enabled) {
      return;
    }
    let active = true;
    setIsFetching(true);
    // Use ref to get latest options without causing dependency issues
    client
      .fetchQuery(optionsRef.current)
      .then((next) => {
        if (!active) return;
        setData(next);
        setError(undefined);
      })
      .catch((err) => {
        if (!active) return;
        reportConsoleError("react_query.useQuery_failed", err, {
          queryKey: optionsRef.current.queryKey,
        });
        setError(err);
      })
      .finally(() => {
        if (!active) return;
        setIsFetching(false);
      });

    return () => {
      active = false;
    };
  }, [client, queryKeyStr, enabled]);

  return useMemo(
    () => ({ data, isFetching, isError: Boolean(error), error }),
    [data, error, isFetching]
  );
}

export function useMutation<TData, TVariables = void>(options: MutationOptions<TData, TVariables>) {
  const [isPending, setIsPending] = useState(false);

  async function mutateAsync(variables: TVariables): Promise<TData> {
    setIsPending(true);
    try {
      const data = await executeWithRetry(
        () => options.mutationFn(variables),
        options.retry ? 1 : 0,
        undefined
      );
      options.onSuccess?.(data, variables);
      return data;
    } catch (err) {
      reportConsoleError("react_query.useMutation_failed", err);
      options.onError?.(err);
      throw err;
    } finally {
      setIsPending(false);
    }
  }

  return { mutateAsync, isPending };
}

async function executeWithRetry<T>(fn: () => Promise<T>, retry: number, retryDelay?: (attemptIndex: number) => number): Promise<T> {
  let count = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      reportConsoleError("react_query.retry_attempt_failed", err, {
        attempt: count + 1,
        maxAttempts: retry + 1,
      });
      if (count >= retry) {
        throw err;
      }
      const wait = retryDelay ? retryDelay(count) : 0;
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      count += 1;
    }
  }
}
