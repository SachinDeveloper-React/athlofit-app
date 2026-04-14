export type Timeframe = 'Day' | 'Week' | 'Month' | 'Year';

export interface MetricValue {
  value: number | string;
  trend: number; // % change vs prior period
}

export interface HealthMetrics {
  steps:         { value: number; trend: number };
  heartRate:     { value: number; trend: number };
  bloodPressure: { value: string; trend: number };
  calories:      { value: number; trend: number };
  distance:      { value: number; trend: number };
  activityTime:  { value: number; trend: number };
}

export interface RingGoals {
  stepsGoalPercent:    number; // 0–1
  caloriesGoalPercent: number;
  timeGoalPercent:     number;
}

export interface HealthAnalyticsResponse {
  timeframe: Timeframe;
  metrics: HealthMetrics;
  chartDataSets: {
    bp:       number[];
    calories: number[];
    distance: number[];
    heart:    number[];
    steps:    number[];
    time:     number[];
  };
  labels: string[];
  rings:  RingGoals;
}

export interface SyncAnalyticsResponse {
  success: boolean;
  message: string;
}
