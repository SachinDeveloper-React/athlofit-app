import { useMutation } from '@tanstack/react-query';
import { accountService } from '../service/accountService';
import { useAuthStore } from '../../auth/store/authStore';
import type { CompleteProfileRequest } from '../../../types/auth.types';

export function useCompleteProfile() {
  const updateUser = useAuthStore(s => s.updateUser);

  return useMutation({
    mutationFn: (body: CompleteProfileRequest) =>
      accountService.completeProfile(body),

    onSuccess: response => {
      console.log("response", response)
      if (response.success && response.data?.user) {
        // Sync updated user (with isProfileComplete: true) into auth store
        updateUser(response?.data?.user);
      }
    },
  });
}
