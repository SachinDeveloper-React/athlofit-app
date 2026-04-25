import { ApiResponse } from '../../../types/auth.types';

export type ChallengeType = 'daily' | 'weekly';

export type ChallengeCriteria =
  | 'STEPS' | 'CALORIES' | 'ACTIVE_MINUTES' | 'DISTANCE'
  | 'HYDRATION'
  | 'MEALS_LOGGED' | 'NUTRITION_CALORIES' | 'NUTRITION_PROTEIN'
  | 'NUTRITION_DAYS' | 'SPECIFIC_FOOD';

export type ChallengeCategory = 'fitness' | 'nutrition' | 'hydration' | 'wellness';

export interface Challenge {
  _id: string;
  title: string;
  description: string;
  emoji: string;
  color: string;
  type: ChallengeType;
  category: ChallengeCategory;
  criteriaType: ChallengeCriteria;
  targetFood?: string | null;
  targetValue: number;
  coinReward: number;
  currentValue: number;
  isCompleted: boolean;
  isRewarded: boolean;
  periodKey: string;
}

export type ChallengesResponse = ApiResponse<Challenge[]>;
export type ChallengeResponse  = ApiResponse<Challenge>;

export interface ChallengeFilterOption {
  key: string;
  label: string;
  emoji: string;
}

export interface ChallengeConfig {
  typeFilters: ChallengeFilterOption[];
  catFilters:  ChallengeFilterOption[];
  sectionLabels: Record<string, string>;
}

export type ChallengeConfigResponse = ApiResponse<ChallengeConfig>;
