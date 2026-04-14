import { api } from '../../../utils/api';
import {
  HealthAnalyticsResponse,
  SyncAnalyticsResponse,
  Timeframe,
} from '../types/analytics';

export const fetchAnalyticsInfo = async (
  timeframe: Timeframe,
): Promise<HealthAnalyticsResponse> => {
  const res = await api.get<{ success: boolean; message: string; data: HealthAnalyticsResponse }>(
    `health/analytics?period=${timeframe.toLowerCase()}`,
  );
  return res.data;
};

export const syncAnalyticsData = async (): Promise<SyncAnalyticsResponse> => {
  const res = await api.post<{ success: boolean; message: string; data: SyncAnalyticsResponse }>(
    'health/analytics/sync',
  );
  return res.data;
};
