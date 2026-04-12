// src/features/account/service/referralService.ts
import { api } from '../../../utils/api';
import type { ApiResponse } from '../../../types/auth.types';

export interface ReferralUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  joinedAt: string;
  bonusAwarded: boolean;
}

export interface ReferralStats {
  referralCode: string;
  totalReferred: number;
  bonusCoinsEarned: number;
  referrerBonus: number;
  refereeBonus: number;
  referrals: ReferralUser[];
}

export interface ApplyReferralResponse {
  refereeNewBalance: number;
  refereeBonus: number;
  referrerName: string;
}

export const referralService = {
  getStats: () =>
    api.get<ApiResponse<ReferralStats>>('referral/me'),

  applyCode: (referralCode: string) =>
    api.post<ApiResponse<ApplyReferralResponse>>('referral/apply', { referralCode }),
};
