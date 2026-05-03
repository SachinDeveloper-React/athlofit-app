// src/features/health/service/periodStatsService.ts
import { api } from '../../../utils/api';
import type { PeriodStat, PeriodStatsResponse } from '../types/periodStats.types';

export type { PeriodStat, PeriodStatsResponse };

export const fetchPeriodStats = async (): Promise<PeriodStatsResponse> => {
  const res = await api.get<{ data: PeriodStatsResponse }>('health/period-stats');
  return res.data;
};
