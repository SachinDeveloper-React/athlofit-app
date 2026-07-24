// ─── gamification.type.ts ───────────────────────────────────────────────────

import { ApiResponse } from "../../../types/auth.types";

export interface GamificationState {
  coinsBalance: number;
  streakDays: number;
  bestStreakDays: number;
  lastActiveDate: string | null;
  coinsEarnedToday: number;
  lastCoinDate: string | null;
  // Anti-cheat: coin block penalty info (null if not blocked)
  coinBlocked: CoinBlockedInfo | null;
}

/** Info returned from backend when user is blocked from earning coins */
export interface CoinBlockedInfo {
  blocked: boolean;
  blockedUntil: string; // ISO date
  daysRemaining: number;
  message?: string;
}

export type GamificationResponse = ApiResponse<GamificationState>;

export type BadgeKey = string; // Dynamic — keys are defined in BadgeDefinition DB records

export interface TrackerBadge {
  key: BadgeKey;
  title: string;
  rule: string;
  emoji: string;     // e.g. '🥉' — served from API
  color: string;     // e.g. '#cd7f32' — served from API
  threshold: number; // streak days needed — served from API
  coinReward: number; // coins awarded on unlock — served from API
  unlocked: boolean;
  unlockedAt?: string | null;
}

export interface StreaksResponseData {
  streakDays: number;
  bestStreakDays: number;
  nextBadgeAt: number;
  badges: TrackerBadge[];
}

export type StreaksResponse = ApiResponse<StreaksResponseData>;

export interface EarnCoinsPayload {
  coinsBalance: number;
  coinsEarnedToday: number;
}

export type EarnCoinsResponse = ApiResponse<EarnCoinsPayload>;

export interface GamificationStore extends GamificationState {
  setCoinsBalance: (balance: number) => void;
  syncDailyProgress: (coinsEarnedThisDay: number, metGoal: boolean) => void;
  checkAndResetDaily: () => void;
  syncWithService: (data: Partial<GamificationState>) => void;
  reset: () => void;
}

export type TransactionType = 'EARNED' | 'SPENT' | 'EXPIRED';

export type TransactionCategory =
  | 'PASSIVE_STEPS'
  | 'DAILY_STEP_GOAL'
  | 'DAILY_STEP_GOAL_AUTO'
  | 'HYDRATION_GOAL'
  | 'STREAK_BADGE'
  | 'ACHIEVEMENT'
  | 'CHALLENGE'
  | 'REFERRAL_BONUS'
  | 'SHOP_PURCHASE'
  | 'SHOP_REFUND'
  | 'MANUAL';

export interface CoinTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  source: string;
  createdAt: string;
  balanceAfter?: number;
  category?: TransactionCategory;
}

export interface ClaimableReward {
  id: string;
  title: string;
  threshold: number;
  reward: number;
  currentValue: number;
  isClaimed: boolean;
}

export interface CoinData {
  balance: number;
  transactions: CoinTransaction[];
  claimable: ClaimableReward[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export type CoinDataResponse = ApiResponse<CoinData>;

export interface ClaimRewardResponseData {
  newBalance: number;
  rewardId: string;
}

export type ClaimRewardResponse = ApiResponse<ClaimRewardResponseData>;
