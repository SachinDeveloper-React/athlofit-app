import { useMutation } from '@tanstack/react-query';
import { authService } from '../service/authService';
import { useAuthStore } from '../store/authStore';
import type { LoginRequest } from '../../../types/auth.types';

export function useLogin() {
  const setAuth = useAuthStore(s => s.setAuth);

  return useMutation({
    mutationFn: (body: LoginRequest) => authService.login(body),
    onSuccess: response => {
      const { success, data } = response;

      if (!success) return;

      if (data?.user && data?.accessToken && data?.refreshToken) {
        setAuth(data.user, {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresIn: 36000,
        });
      }
    },
  });
}
