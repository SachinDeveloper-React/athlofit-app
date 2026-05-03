// src/features/health/service/dayDetailService.ts
import { api } from '../../../utils/api';
import type { DayDetailResponse } from '../types/dayDetail.types';

export const fetchDayDetail = async (date: string): Promise<DayDetailResponse> => {
  const res = await api.get<{ data: DayDetailResponse }>(`health/day-detail?date=${date}`);
  return res.data;
};
