// ─── gamification.service.ts ─────────────────────────────────────────────

import { api } from '../../../utils/api';
import type { GamificationResponse, GamificationState, StreaksResponse, EarnCoinsResponse, CoinDataResponse, ClaimRewardResponse } from '../types/gamification.type';
import type { ApiResponse } from '../../../types/auth.types';

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
};