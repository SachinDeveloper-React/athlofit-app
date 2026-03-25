// src/features/auth/hooks/useForgotPassword.ts

import { useMutation } from '@tanstack/react-query';
import { authService } from '../service/authService';
import type { ForgotPasswordRequest } from '../../../types/auth.types';

export function useForgotPassword() {
  return useMutation({
    mutationFn: (body: ForgotPasswordRequest) =>
      authService.forgotPassword(body),
  });
}
