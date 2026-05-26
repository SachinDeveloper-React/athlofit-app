import { useMutation } from '@tanstack/react-query';
import { accountService } from '../service/accountService';
import { useAuthStore } from '../../auth/store/authStore';
import { bmiService } from '../../health/service/bmi.service';
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

        // Auto-calculate and save BMI if user provided height and weight
        const user = response.data.user;
        if (user.weight && user.weight > 0 && user.height && user.height > 0) {
          const heightM = user.height / 100; // convert cm to meters
          bmiService.save({ weight: user.weight, height: heightM }).catch(() => {});
        }
      }
    },
  });
}
