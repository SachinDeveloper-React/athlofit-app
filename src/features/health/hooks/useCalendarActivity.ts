// src/features/health/hooks/useCalendarActivity.ts
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCalendarActivity } from '../service/calendarService';

export function useCalendarActivity() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-based

  const query = useQuery({
    queryKey: ['calendarActivity', year, month],
    queryFn:  () => fetchCalendarActivity(year, month),
    staleTime: 5 * 60_000,
  });

  const selectMonth = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
  };

  return { ...query, year, month, selectMonth };
}
