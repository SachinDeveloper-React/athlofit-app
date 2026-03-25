import { useMutation } from '@tanstack/react-query';
import { authService } from '../service/authService';
import type { RegisterRequest } from '../../../types/auth.types';

export function useRegister() {
  return useMutation({
    mutationFn: (body: RegisterRequest) => authService.register(body),
    onSuccess: ({ data }) => {
      // setAuth(data.user, data.tokens);
    },
  });
}
