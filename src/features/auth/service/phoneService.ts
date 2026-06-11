// src/features/auth/service/phoneService.ts
// Phone verification API calls

import { api } from '../../../utils/api';
import type { ApiResponse } from '../../../types/auth.types';

interface SendOtpResponse {
  phone: string; // masked: ******1234
}

interface VerifyOtpResponse {
  phoneVerified: boolean;
  phone: string;
}

export const phoneService = {
  sendOtp: async (phone: string) => {
    const response = await api.post<ApiResponse<SendOtpResponse>>(
      'phone/send-otp',
      { phone }
    );
    return response;
  },

  verifyOtp: async (otp: string) => {
    const response = await api.post<ApiResponse<VerifyOtpResponse>>(
      'phone/verify-otp',
      { otp }
    );
    return response;
  },
};
