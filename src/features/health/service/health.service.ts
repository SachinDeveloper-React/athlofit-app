import { api } from '../../../utils/api';
import { MetricRow } from '../components/tracker/DailyStatsSection';
import {
  HealthData,
  WeeklyStepsRequest,
  WeeklyStepsResponse,
} from '../types/healthTypes';

export const healthService = {
  getWeeklySteps: async (params: WeeklyStepsRequest) => {
    const response = await api.get<WeeklyStepsResponse>(
      `health/weekly-steps?from=${params.from}&to=${params.to}`,
    );

    return {
      success: response.success,
      message: response.message,
      data: response.data ?? [],
    };
  },
};

export function buildMetricRows(data: HealthData): MetricRow[] {
  return [
    [
      {
        iconName: 'MapPin',
        iconColor: '#0F6E56',
        iconBg: '#E1F5EE',
        value: data.distance.toFixed(1),
        valueSuffix: 'km',
        label: 'Distance',
        unit: 'km',
      },
      {
        iconName: 'Timer',
        iconColor: '#185FA5',
        iconBg: '#E6F1FB',
        value: data.activeMinutes,
        valueSuffix: 'min',
        label: 'Active time',
        unit: 'min',
      },
    ],
    [
      {
        iconName: 'Flame',
        iconColor: '#993C1D',
        iconBg: '#FAECE7',
        value: data.calories,
        valueSuffix: 'kcal',
        label: 'Calories',
        unit: 'kcal',
      },
      {
        iconName: 'Heart',
        iconColor: '#993556',
        iconBg: '#FBEAF0',
        value: data.heartRate,
        label: 'Heart rate',
        unit: 'bpm',
      },
    ],
  ];
}
