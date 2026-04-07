// src/config/appConfig.ts
// ─── Fallback config used before the server responds ────────────────────────
// Update coin rate, goals etc. via GET /config/app — no client deploy needed.

export const APP_CONFIG_DEFAULTS = {
  coin: {
    conversionRate: 10,    // 10 coins = ₹1
    dailyEarnLimit: 10,    // max coins earnable per day from steps
    coinsPerStepKm: 1,
    purchaseEnabled: true,
  },
  steps: {
    defaultDailyGoal: 8000,
    maxDailyGoal: 30000,
  },
  features: {
    shopEnabled: true,
    ordersEnabled: true,
    healthAnalyticsEnabled: true,
  },
} as const;

export type AppConfig = typeof APP_CONFIG_DEFAULTS;

/** Derive coin price from a ₹ amount using the live conversion rate */
export const toCoinPrice = (rupees: number, rate: number) =>
  Math.round(rupees * rate);

/** Format coin number: 1200 → "1.2k" */
export const formatCoins = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();
