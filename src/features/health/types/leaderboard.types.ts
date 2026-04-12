// src/features/health/types/leaderboard.types.ts

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  coinsBalance: number;
  streakDays: number;
  badgesCount: number;
}

export interface LeaderboardResponse {
  success: boolean;
  message: string;
  data: LeaderboardEntry[];
}
