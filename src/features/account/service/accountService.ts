import { api } from '../../../utils/api';
import type {
  ApiResponse,
  User,
  CompleteProfileRequest,
  CompleteProfileResponse,
} from '../../../types/auth.types';

export const accountService = {
  completeProfile: async (body: CompleteProfileRequest) => {
    const response = await api.post<CompleteProfileResponse>(
      'user/complete-profile',
      body,
    );

    console.log("response", response)
    return {
      success: response?.data.status === "success",
      message: response?.data.message,
      data: {
        user: response?.data?.user,
      },
    };
  },

  getProfile: () => api.get<ApiResponse<User>>('user/profile'),

  updateProfile: (body: Partial<CompleteProfileRequest> & { name?: string }) =>
    api.patch<ApiResponse<User>>('user/profile', body),
};

export const formatInt = (n: number) =>
  n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const formatDateLabel = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }); // → "23 Jan"
};
