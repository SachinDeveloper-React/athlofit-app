export const CATEGORY_META = {
  underweight: { label: 'Underweight', color: '#3B82F6', bg: '#EFF6FF', min: 0,    max: 18.4 },
  normal:      { label: 'Normal',      color: '#22C55E', bg: '#F0FDF4', min: 18.5,  max: 24.9 },
  overweight:  { label: 'Overweight',  color: '#F59E0B', bg: '#FFFBEB', min: 25.0,  max: 29.9 },
  obese:       { label: 'Obese',       color: '#EF4444', bg: '#FEF2F2', min: 30.0,  max: 40.0 },
} as const;

export type BmiCategory = keyof typeof CATEGORY_META;

export function calcBmi(weightKg: number, heightM: number): number {
  if (!weightKg || !heightM) return 0;
  return parseFloat((weightKg / (heightM * heightM)).toFixed(1));
}

export function getCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25.0) return 'normal';
  if (bmi < 30.0) return 'overweight';
  return 'obese';
}

export function idealWeightRange(heightM: number) {
  return {
    min: parseFloat((18.5 * heightM * heightM).toFixed(1)),
    max: parseFloat((24.9 * heightM * heightM).toFixed(1)),
  };
}

export const BMI_MIN = 10;
export const BMI_MAX = 40;
