import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@/lib/api";

export function useFileTree(rootPath) {
  const [cache, setCache] = useState({});
  const [loading, setLoading] = useState({});
  const [expanded, setExpanded] = useState(() => new Set());

  const cacheRef = useRef({});
  const loadingRef = useRef({});
  const generationRef = useRef(0);
  const rootPathRef = useRef(rootPath);

  const fetchChildren = useCallback(async (path, generation = generationRef.current) => {
    if (!path || cacheRef.current[path] || loadingRef.current[path]) {
      return cacheRef.current[path] ?? [];
    }

    loadingRef.current = { ...loadingRef.current, [path]: true };
    setLoading((current) => ({ ...current, [path]: true }));

    try {
      const result = await invoke("read_dir", { path });
      const entries = Array.isArray(result) ? result : [];

      if (generation !== generationRef.current || !rootPathRef.current) {
        return entries;
      }

      cacheRef.current = { ...cacheRef.current, [path]: entries };
      setCache((current) => ({ ...current, [path]: entries }));
      return entries;
    } catch (error) {
      console.error(`read_dir failed for ${path}:`, error);
      return [];
    } finally {
      if (generation !== generationRef.current || !rootPathRef.current) {
        return;
      }

      loadingRef.current = { ...loadingRef.current, [path]: false };
      setLoading((current) => ({ ...current, [path]: false }));
    }
  }, []);

  useEffect(() => {
    rootPathRef.current = rootPath;
    generationRef.current += 1;
    cacheRef.current = {};
    loadingRef.current = {};
    setCache({});
    setLoading({});
    setExpanded(new Set());

    if (!rootPath) {
      return;
    }

    void fetchChildren(rootPath, generationRef.current);
  }, [fetchChildren, rootPath]);

  const toggleExpanded = useCallback(
    (path) => {
      if (!path) {
        return;
      }

      let shouldFetch = false;

      setExpanded((current) => {
        const next = new Set(current);
        if (next.has(path)) {
          next.delete(path);
          return next;
        }

        next.add(path);
        shouldFetch = !cacheRef.current[path];
        return next;
      });

      if (shouldFetch) {
        void fetchChildren(path);
      }
    },
    [fetchChildren]
  );

  const childrenOf = useCallback((path) => cache[path] ?? [], [cache]);
  const isExpanded = useCallback((path) => expanded.has(path), [expanded]);
  const isLoading = useCallback((path) => Boolean(loading[path]), [loading]);

  return { childrenOf, toggleExpanded, isExpanded, isLoading };
}
