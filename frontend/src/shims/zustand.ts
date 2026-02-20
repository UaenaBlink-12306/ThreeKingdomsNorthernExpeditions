import { useSyncExternalStore } from "react";

type Setter<T> = (partial: Partial<T>) => void;

type Creator<T> = (set: Setter<T>) => T;

export function create<T>(creator: Creator<T>) {
  let state = {} as T;
  const listeners = new Set<() => void>();

  const set: Setter<T> = (partial) => {
    state = { ...state, ...partial };
    listeners.forEach((listener) => listener());
  };

  state = creator(set);

  function useStore(): T {
    return useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => state,
      () => state
    );
  }

  useStore.setState = set;

  return useStore as typeof useStore & { setState: Setter<T> };
}
