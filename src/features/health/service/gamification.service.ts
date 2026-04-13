// ─── gamification.service.ts ─────────────────────────────────────────────

import { api } from '../../../utils/api';
import type { GamificationResponse, GamificationState, StreaksResponse, EarnCoinsResponse, CoinDataResponse, ClaimRewardResponse } from '../types/gamification.type';
import type { ApiResponse } from '../../../types/auth.types';
import type { LeaderboardEntry } from '../types/leaderboard.types';

export const gamificationService = {
  getGamification: async () => {
    const response = await api.get<GamificationResponse>(
      'gamification/me'
    );

    return {
      success: response.success,
      message: response.message,
      data: response.data,
    };
  },

  getStreaks: async () => {
    const response = await api.get<StreaksResponse>(
      'gamification/streaks'
    );

    return {
      success: response.success,
      message: response.message,
      data: response.data,
    };
  },

  syncGamification: async (body: Partial<GamificationState>) => {
    const response = await api.post<ApiResponse>(
      'gamification/sync',
      body
    );

    return {
      success: response.success,
      message: response.message,
    };
  },

  earnCoins: async (coinsToAdd: number) => {
    const response = await api.post<EarnCoinsResponse>(
      'gamification/coins/earn',
      { coinsToAdd }
    );
    return {
      success: response.success,
      message: response.message,
      data: response.data,
    };
  },

  getCoinData: async () => {
    const response = await api.get<CoinDataResponse>(
      'gamification/coins/data'
    );
    return {
      success: response.success,
      message: response.message,
      data: response.data,
    };
  },

  claimReward: async (rewardId: string) => {
    const response = await api.post<ClaimRewardResponse>(
      'gamification/coins/claim',
      { rewardId }
    );
    return {
      success: response.success,
      message: response.message,
      data: response.data,
    };
  },

  getAdvancedAchievements: async () => {
    const response = await api.get<any>(
      'gamification/achievements'
    );
    return {
      success: response.success,
      message: response.message,
      data: response.data,
    };
  },

  claimAdvancedAchievement: async (achievementId: string) => {
    const response = await api.post<any>(
      'gamification/achievements/claim',
      { achievementId }
    );
    return {
      success: response.success,
      message: response.message,
      data: response.data,
    };
  },

  getLeaderboard: async () => {
    const response = await api.get<ApiResponse<LeaderboardEntry[]>>(
      'gamification/leaderboard'
    );
    return {
      success: response.success,
      message: response.message,
      data: response.data as LeaderboardEntry[],
    };
  },

  // ─── Admin: Badge Definitions ─────────────────────────────────────────────

  adminGetBadges: async () => {
    const response = await api.get<any>('gamification/admin/badges');
    return { success: response.success, message: response.message, data: response.data };
  },

  adminCreateBadge: async (badge: {
    key: string;
    title: string;
    rule: string;
    emoji: string;
    color: string;
    threshold: number;
    coinReward: number;
    order?: number;
    isActive?: boolean;
  }) => {
    const response = await api.post<any>('gamification/admin/badges', badge);
    return { success: response.success, message: response.message, data: response.data };
  },

  adminUpdateBadge: async (id: string, updates: Partial<{
    title: string;
    rule: string;
    emoji: string;
    color: string;
    threshold: number;
    coinReward: number;
    order: number;
    isActive: boolean;
  }>) => {
    const response = await api.put<any>(`gamification/admin/badges/${id}`, updates);
    return { success: response.success, message: response.message, data: response.data };
  },

  adminDeleteBadge: async (id: string) => {
    const response = await api.delete<any>(`gamification/admin/badges/${id}`);
    return { success: response.success, message: response.message, data: response.data };
  },
};