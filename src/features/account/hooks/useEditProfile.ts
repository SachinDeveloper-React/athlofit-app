import { useMutation, useQueryClient } from '@tanstack/react-query';
import { accountService } from '../service/accountService';
import { useAuthStore } from '../../auth/store/authStore';
import type { CompleteProfileRequest, User } from '../../../types/auth.types';

export function useEditProfile() {
  const queryClient = useQueryClient();
  const updateUser = useAuthStore(s => s.updateUser);

  return useMutation({
    mutationFn: (body: Partial<CompleteProfileRequest> & { name?: string }) =>
      accountService.updateProfile(body),

    onSuccess: response => {
      // The backend returns user directly inside response.data
      if (response && response.data) {
        // Sync updated user into auth store
        updateUser(response.data);
        
        // Invalidate profile query to ensure data consistency across the app
        queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      }
    },
  });
}
