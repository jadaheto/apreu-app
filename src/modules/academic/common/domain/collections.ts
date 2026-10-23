/** Distinct values preserving first-seen order. */
export const unique = <T>(values: Iterable<T>): T[] => [...new Set(values)];

/** Indexes items by a key; later items with the same key win. */
export const indexBy = <T, K>(items: Iterable<T>, key: (item: T) => K): Map<K, T> => {
  const index = new Map<K, T>();
  for (const item of items) index.set(key(item), item);
  return index;
};

/** Groups items by a key preserving order inside each group. */
export const groupBy = <T, K>(items: Iterable<T>, key: (item: T) => K): Map<K, T[]> => {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return groups;
};
