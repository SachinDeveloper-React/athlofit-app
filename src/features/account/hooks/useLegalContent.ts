import { useQuery } from '@tanstack/react-query';
import { legalService } from '../service/legalService';

export function useLegalContent(type: 'terms' | 'privacy') {
  return useQuery({
    queryKey: ['legal-content', type],
    queryFn: () =>
      type === 'terms'
        ? legalService.getTerms()
        : legalService.getPrivacy(),
  });
}
