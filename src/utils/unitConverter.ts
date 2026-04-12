// src/utils/unitConverter.ts
// Pure unit conversion utilities — no React dependencies

export type UnitSystem = 'metric' | 'imperial';

// ─── Weight conversion ────────────────────────────────────────────────────────
export const kgToLbs = (kg: number): number => Math.round(kg * 2.20462 * 10) / 10;
export const lbsToKg = (lbs: number): number => Math.round(lbs / 2.20462 * 10) / 10;

// ─── Height conversion ────────────────────────────────────────────────────────
export const cmToFeet = (cm: number): number => Math.floor(cm / 30.48);
export const cmToInches = (cm: number): number => Math.round((cm / 2.54) % 12);
export const ftInToCm = (feet: number, inches: number): number =>
  Math.round((feet * 30.48) + (inches * 2.54));

// ─── Format helpers ───────────────────────────────────────────────────────────
export const formatWeight = (kg: number, system: UnitSystem): string => {
  if (system === 'imperial') return `${kgToLbs(kg)} lbs`;
  return `${kg} kg`;
};

export const formatWeightValue = (kg: number, system: UnitSystem): number =>
  system === 'imperial' ? kgToLbs(kg) : kg;

export const formatWeightUnit = (system: UnitSystem): string =>
  system === 'imperial' ? 'lbs' : 'kg';

export const formatHeight = (cm: number, system: UnitSystem): string => {
  if (system === 'imperial') {
    const feet = cmToFeet(cm);
    const inches = cmToInches(cm);
    return `${feet}'${inches}"`;
  }
  return `${cm} cm`;
};

export const formatHeightValue = (cm: number, system: UnitSystem): number =>
  system === 'imperial' ? Math.round((cm / 2.54) * 10) / 10 : cm;

export const formatHeightUnit = (system: UnitSystem): string =>
  system === 'imperial' ? 'in' : 'cm';

// Convert height input back to cm for storage
export const heightToCm = (value: number, system: UnitSystem): number =>
  system === 'imperial' ? Math.round(value * 2.54) : value;

// Convert weight input back to kg for storage
export const weightToKg = (value: number, system: UnitSystem): number =>
  system === 'imperial' ? lbsToKg(value) : value;
