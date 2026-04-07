// ─── gamification.type.ts ───────────────────────────────────────────────────

import { ApiResponse } from "../../../types/auth.types";

export interface GamificationState {
  coinsBalance: number;
  streakDays: number;
  bestStreakDays: number;
  lastActiveDate: string | null;
  coinsEarnedToday: number;
  lastCoinDate: string | null;
}

export type GamificationResponse = ApiResponse<GamificationState>;

export type BadgeKey = 'starter' | 'consistent' | 'finisher' | 'elite';

export interface TrackerBadge {
  key: BadgeKey;
  title: string;
  rule: string;
  unlocked: boolean;
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
}

export type TransactionType = 'EARNED' | 'SPENT' | 'EXPIRED';

export interface CoinTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  source: string;
  createdAt: string;
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
}

export type CoinDataResponse = ApiResponse<CoinData>;

export interface ClaimRewardResponseData {
  newBalance: number;
  rewardId: string;
}

export type ClaimRewardResponse = ApiResponse<ClaimRewardResponseData>;
