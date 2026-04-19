import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAnalyticsInfo, syncAnalyticsData } from '../service/healthAnalyticsService';
import { Timeframe } from '../types/analytics';

export function useHealthAnalytics(initialTab: Timeframe = 'Day') {
  const [activeTab, setActiveTab] = useState<Timeframe>(initialTab);
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['healthAnalytics', activeTab],
    queryFn: () => fetchAnalyticsInfo(activeTab),
  });

  const syncMutation = useMutation({
    mutationFn: syncAnalyticsData,
    onSuccess: () => {
      // Invalidate queries so that the data is refreshed after successful sync
      queryClient.invalidateQueries({ queryKey: ['healthAnalytics'] });
    },
  });

  return {
    activeTab,
    setActiveTab,
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    syncMutation,
  };
}
