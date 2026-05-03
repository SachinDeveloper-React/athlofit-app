// src/features/health/service/calendarService.ts
import { api } from '../../../utils/api';
import { CalendarActivityResponse } from '../types/calendar.types';

export const fetchCalendarActivity = async (
  year: number,
  month: number,
): Promise<CalendarActivityResponse> => {
  const res = await api.get<{ data: CalendarActivityResponse }>(
    `health/calendar?year=${year}&month=${month}`,
  );
  return res.data;
};
