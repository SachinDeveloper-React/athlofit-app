// src/features/account/hooks/useFaqs.ts
import { useQuery } from '@tanstack/react-query';
import { legalService, FaqItem } from '../service/legalService';

export const useFaqs = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['faqs'],
    queryFn: async () => {
      const res = await legalService.getFaqs();
      return res.data as FaqItem[];
    },
    staleTime: 5 * 60 * 1000, // 5 min — FAQs rarely change
  });

  // Group FAQs by category
  const grouped = (data ?? []).reduce<Record<string, FaqItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return {
    faqs: data ?? [],
    grouped,
    isLoading,
  };
};
