import { api } from '../../../utils/api';
import type {
  ApiResponse,
  User,
  CompleteProfileRequest,
  CompleteProfileResponse,
} from '../../../types/auth.types';

export const accountService = {
  completeProfile: async (body: CompleteProfileRequest) => {
    const response = await api.put<CompleteProfileResponse>(
      'user/profile',
      body,
    );

    return {
      success: response.status,
      message: response.message,
      data: {
        user: response.user,
      },
    };
  },

  getProfile: () => api.get<ApiResponse<{ user: User }>>('user/profile'),

  updateProfile: (body: Partial<CompleteProfileRequest>) =>
    api.put<ApiResponse<{ user: User }>>('user/profile', body),
};
