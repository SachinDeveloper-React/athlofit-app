import { api } from '../../../utils/api';
import type { ChallengesResponse, ChallengeResponse, ChallengeConfigResponse } from '../types/challenge.types';
import type { ApiResponse } from '../../../types/auth.types';

export const challengeService = {
  getAll:    ()           => api.get<ChallengesResponse>('challenges'),
  getById:   (id: string) => api.get<ChallengeResponse>(`challenges/${id}`),
  getConfig: ()           => api.get<ChallengeConfigResponse>('challenges/config'),
  seedData:  ()           => api.post<ApiResponse<any[]>>('challenges/seed', {}),
};
