import type { BPCategory, BPCategoryMeta } from '../types/bloodpressure.types';

export function classifyBP(systolic: number, diastolic: number): BPCategory {
  if (systolic < 90 || diastolic < 60) return 'low';
  if (systolic < 120 && diastolic < 80) return 'normal';
  if (systolic < 130 && diastolic < 80) return 'elevated';
  if (systolic < 140 || diastolic < 90) return 'high1';
  if (systolic < 180 && diastolic < 120) return 'high2';
  return 'crisis';
}

export const CATEGORY_META: Record<BPCategory, BPCategoryMeta> = {
  low: {
    label: 'Low',
    color: '#60a5fa',
    bg: '#eff6ff',
    icon: '↓',
    advice: 'Consult your doctor if you feel dizzy or faint.',
  },
  normal: {
    label: 'Normal',
    color: '#22c55e',
    bg: '#f0fdf4',
    icon: '✓',
    advice: 'Great! Keep maintaining a healthy lifestyle.',
  },
  elevated: {
    label: 'Elevated',
    color: '#f59e0b',
    bg: '#fffbeb',
    icon: '↑',
    advice: 'Lifestyle changes recommended. Monitor regularly.',
  },
  high1: {
    label: 'High Stage 1',
    color: '#f97316',
    bg: '#fff7ed',
    icon: '⚠',
    advice: 'Consult a doctor. Lifestyle changes needed.',
  },
  high2: {
    label: 'High Stage 2',
    color: '#ef4444',
    bg: '#fef2f2',
    icon: '⚠',
    advice: 'Medical attention recommended soon.',
  },
  crisis: {
    label: 'Hypertensive Crisis',
    color: '#991b1b',
    bg: '#fef2f2',
    icon: '🚨',
    advice: 'Seek emergency medical care immediately!',
  },
};
