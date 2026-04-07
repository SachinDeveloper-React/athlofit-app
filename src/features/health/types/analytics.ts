export type Timeframe = 'Day' | 'Week' | 'Month' | 'Year';

export interface  HealthMetrics {
  steps: { value: number; change: number };
  heartRate: { value: number; change: number };
  bloodPressure: { value: string; change: number };
  calories: { value: number; change: number };
  distance: { value: number; change: number };
  activityTime: { value: number; change: number };
}

export interface HealthAnalyticsResponse {
  timeframe: Timeframe;
  metrics: HealthMetrics;
  chartDataSets: {
  bp: number[];
  calories: number[];
  distance: number[];
  heart: number[];
  steps: number[];
  time: number[];
  }
  labels: string[];       // X-axis labels
}

export interface SyncAnalyticsResponse {
  success: boolean;
  message: string;
}
