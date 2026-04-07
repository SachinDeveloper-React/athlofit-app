import { useMutation } from '@tanstack/react-query';
import { legalService, SupportRequest } from '../service/legalService';

export function useSupportMutation() {
  return useMutation({
    mutationFn: (body: SupportRequest) => legalService.submitSupport(body),
  });
}
