import { api } from '../../../utils/api';
import type {
  LoginRequest,
  RegisterRequest,
  ForgotPasswordRequest,
  VerifyOtpRequest,
  ResetPasswordRequest,
  ResendOtpRequest,
  AuthResponse,
  OtpResponse,
  ApiResponse,
  SignUpResponse,
  User,
} from '../../../types/auth.types';

export const authService = {
  login: async (body: LoginRequest) => {
    const response = await api.post<AuthResponse>('auth/user/login', body, {
      auth: false,
    });

    return {
      success: response.accessToken && response.refreshToken && response.user,
      message: response.message,
      data: {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        user: response.user,
      },
    };
  },

  register: (body: RegisterRequest) =>
    api.post<SignUpResponse>('auth/user/signup', body, { auth: false }),

  forgotPassword: (body: ForgotPasswordRequest) =>
    api.post<ApiResponse>('/auth/forgot-password', body, { auth: false }),

  verifyOtp: async (body: VerifyOtpRequest) => {
    const response = await api.post<OtpResponse>(
      '/auth/user/signup-verify',
      body,
      { auth: false },
    );
    return {
      success: response.status === 'success',
      message: response.message,
      data: {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        user: response.user,
      },
    };
  },

  resendOtp: (body: ResendOtpRequest) =>
    api.post<ApiResponse>('auth/resend-otp', body, { auth: false }),

  resetPassword: (body: ResetPasswordRequest) =>
    api.post<ApiResponse>('auth/reset-password', body, { auth: false }),

  logout: () => api.post<ApiResponse>('auth/logout'),

  me: async () => {
    const response = await api.get<ApiResponse<User>>('user/profile');

    return {
      success: response.success,
      message: response.message,
      data: response.data,
    };
  },
};
