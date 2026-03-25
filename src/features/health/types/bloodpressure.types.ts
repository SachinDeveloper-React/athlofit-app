// ─── Blood Pressure Types ─────────────────────────────────────────────────────

export type BPCategory =
  | 'low'
  | 'normal'
  | 'elevated'
  | 'high1'
  | 'high2'
  | 'crisis';

export type InputMode = 'manual' | 'device';

export interface BPReading {
  id: string;
  systolic: number;
  diastolic: number;
  pulse?: number;
  timestamp: Date;
  source: 'manual' | 'device';
  deviceName?: string;
  category: BPCategory;
}

export interface BPCategoryMeta {
  label: string;
  color: string;
  bg: string;
  icon: string;
  advice: string;
}

export interface ParsedBPMeasurement {
  systolic: number;
  diastolic: number;
  pulse?: number;
}
