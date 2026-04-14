// src/config/appConfig.ts
// ─── Fallback config used before the server responds ────────────────────────
// All values here are overridden by GET /config/app — no client deploy needed.

export const APP_CONFIG_DEFAULTS = {
  coin: {
    conversionRate:  10,   // 10 coins = ₹1
    dailyEarnLimit:  10,   // max passive coins/day from steps
    maxDailyRewards: 250,  // max claimable coins/day
    coinsPerStepKm:  1,
    purchaseEnabled: true,
    referrerBonus:   100,  // coins to referrer per successful referral
    refereeBonus:    50,   // coins to new user on first referral use
  },
  steps: {
    defaultDailyGoal: 8000,
    maxDailyGoal:     30000,
  },
  rewards: {
    stepGoalCoins:      50,    // coins for completing daily step goal
    hydrationGoalCoins: 20,    // coins for completing daily water goal
    hydrationGoalMl:    2000,  // water threshold in ml
  },
  features: {
    shopEnabled:            true,
    ordersEnabled:          true,
    healthAnalyticsEnabled: true,
    referralEnabled:        true,
    leaderboardEnabled:     true,
  },
  maintenance: {
    enabled: false,
    message: 'We are under maintenance. Back soon!',
  },
  support: {
    email:   'support@athlofit.com',
    website: 'www.athlofit.com/faq',
  },
} as const;

export type AppConfig = {
  coin: {
    conversionRate:  number;
    dailyEarnLimit:  number;
    maxDailyRewards: number;
    coinsPerStepKm:  number;
    purchaseEnabled: boolean;
    referrerBonus:   number;
    refereeBonus:    number;
  };
  steps: {
    defaultDailyGoal: number;
    maxDailyGoal:     number;
  };
  rewards: {
    stepGoalCoins:      number;
    hydrationGoalCoins: number;
    hydrationGoalMl:    number;
  };
  features: {
    shopEnabled:            boolean;
    ordersEnabled:          boolean;
    healthAnalyticsEnabled: boolean;
    referralEnabled:        boolean;
    leaderboardEnabled:     boolean;
  };
  maintenance: {
    enabled: boolean;
    message: string;
  };
  support: {
    email:   string;
    website: string;
  };
};

/** Derive coin price from a ₹ amount using the live conversion rate */
export const toCoinPrice = (rupees: number, rate: number) =>
  Math.round(rupees * rate);

/** Format coin number: 1200 → "1.2k" */
export const formatCoins = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();
