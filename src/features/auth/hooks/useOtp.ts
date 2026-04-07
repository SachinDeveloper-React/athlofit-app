import { useMutation } from '@tanstack/react-query';
import { authService } from '../service/authService';
import type {
  VerifyOtpRequest,
  ResendOtpRequest,
} from '../../../types/auth.types';
import { useAuthStore } from '../store/authStore';

export function useVerifyOtp() {
  const setAuth = useAuthStore(s => s.setAuth);
  return useMutation({
    mutationFn: (body: VerifyOtpRequest) => authService.verifyOtp(body),
    onSuccess(response) {
      console.log("response", response)
      const { success, data } = response;
      if (!success) return;

      if (data?.user && data?.accessToken && data?.refreshToken) {
        setAuth(data.user, {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresIn: 36000, // adjust to match your API
        });
        // RootNavigator auth gate picks up isAuthenticated=true automatically
      }
    },
  });
}

export function useResendOtp() {
  return useMutation({
    mutationFn: (body: ResendOtpRequest) => authService.resendOtp(body),
  });
}
