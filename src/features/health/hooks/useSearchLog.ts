// ─── useSearchLog.ts ──────────────────────────────────────────────────────────
// Lightweight hook for logging food search queries and result clicks.
//
// Usage:
//   const { logQuery, logClick } = useSearchLog();
//
//   // When the user submits / debounces a search term:
//   logQuery('kela');
//
//   // When the user taps a food card:
//   logClick({ query: 'kela', item: food, position: 2 });
//
// Both calls are fire-and-forget — failures are silently swallowed so they
// never interrupt the user experience.
//
// Extra fields can be passed via the `meta` parameter:
//   logQuery('banana', { screen: 'FoodCatalog', sessionId: '...' });

import { useCallback, useRef } from 'react';
import { nutritionService } from '../service/nutrition.service';
import type { FoodItem } from '../types/nutrition.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SearchLogMeta {
  screen?: string;
  sessionId?: string;
  [key: string]: unknown;   // any additional fields
}

export interface LogClickParams {
  query: string;
  item: FoodItem;
  /** 0-indexed position in the result list */
  position?: number;
  meta?: SearchLogMeta;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSearchLog(defaultMeta?: SearchLogMeta) {
  // Keep a stable ref to defaultMeta so callbacks don't re-create on every render
  const defaultMetaRef = useRef(defaultMeta);
  defaultMetaRef.current = defaultMeta;

  /**
   * Log a search query event.
   * @param query  - raw text the user typed
   * @param meta   - optional extra fields merged with defaultMeta
   */
  const logQuery = useCallback(
    (query: string, meta?: SearchLogMeta) => {
      if (!query.trim()) return;
      const merged = { ...defaultMetaRef.current, ...meta };
      nutritionService.logSearchQuery(query, merged).catch(() => {
        // fire-and-forget — never surface logging errors to the user
      });
    },
    [],
  );

  /**
   * Log a result-click event.
   * @param params - query, clicked food item, optional position + meta
   */
  const logClick = useCallback(
    ({ query, item, position, meta }: LogClickParams) => {
      if (!query.trim()) return;
      const merged = { ...defaultMetaRef.current, ...meta };
      nutritionService
        .logSearchClick({
          query,
          clickedFoodId: item._id,
          clickedFoodName: item.name,
          resultPosition: position,
          meta: merged,
        })
        .catch(() => {});
    },
    [],
  );

  return { logQuery, logClick };
}
