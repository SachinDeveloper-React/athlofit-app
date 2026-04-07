import { api } from '../../../utils/api';
import {
  HealthAnalyticsResponse,
  SyncAnalyticsResponse,
  Timeframe,
} from '../types/analytics';

export const fetchAnalyticsInfo = async (
  timeframe: Timeframe,
): Promise<HealthAnalyticsResponse> => {
  const res = await api.get<{ data: HealthAnalyticsResponse }>(
    `user/analytics?period=${timeframe.toLowerCase()}`,
  );
  return res.data;
};

export const syncAnalyticsData = async (): Promise<SyncAnalyticsResponse> => {
  const res = await api.post<{ data: SyncAnalyticsResponse }>(
    'user/analytics/sync',
  );
  return res.data;
};
