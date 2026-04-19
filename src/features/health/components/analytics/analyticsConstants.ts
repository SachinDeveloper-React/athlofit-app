import {
  Activity,
  Heart,
  Droplets,
  Flame,
  MapPin,
  Clock,
} from 'lucide-react-native';

export const METRIC_CONFIG = {
  steps: {
    label: 'Steps',
    unit: 'steps',
    icon: Activity,
    color: '#0099FF',
    bg: '#E6F4FF',
    darkBg: '#0D2A40',
    chartKey: 'steps' as const,
  },
  heartRate: {
    label: 'Heart Rate',
    unit: 'bpm',
    icon: Heart,
    color: '#EF4444',
    bg: '#FEF2F2',
    darkBg: '#3A1515',
    chartKey: 'heart' as const,
  },
  bloodPressure: {
    label: 'Blood Pressure',
    unit: 'mmHg',
    icon: Droplets,
    color: '#8B5CF6',
    bg: '#F5F3FF',
    darkBg: '#2A1A40',
    chartKey: 'bp' as const,
  },
  calories: {
    label: 'Calories',
    unit: 'kcal',
    icon: Flame,
    color: '#F97316',
    bg: '#FFF7ED',
    darkBg: '#3A1F0A',
    chartKey: 'calories' as const,
  },
  distance: {
    label: 'Distance',
    unit: 'km',
    icon: MapPin,
    color: '#10B981',
    bg: '#ECFDF5',
    darkBg: '#0A2A1E',
    chartKey: 'distance' as const,
  },
  activityTime: {
    label: 'Active Time',
    unit: 'min',
    icon: Clock,
    color: '#F59E0B',
    bg: '#FFFBEB',
    darkBg: '#2A2008',
    chartKey: 'time' as const,
  },
} as const;

export type MetricKey = keyof typeof METRIC_CONFIG;

export const RING_SIZE = 80;
export const RING_STROKE = 8;
export const RING_R = (RING_SIZE - RING_STROKE) / 2;
export const RING_CIRC = 2 * Math.PI * RING_R;
