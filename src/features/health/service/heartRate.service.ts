import { writeHeartRateHC } from './healthConnect.service';
import { writeHeartRateHK } from './healthkit.service';
import type { HealthPlatform } from '../hooks/useHealth';

export const MEASURE_DURATION_S = 30;
export const VALID_BPM_MIN = 40;
export const VALID_BPM_MAX = 200;

export type HeartRateConfidence = 'high' | 'medium' | 'low';

export interface HeartRateResult {
  bpm: number;
  confidence: HeartRateConfidence;
  samplesUsed: number;
  peaksDetected: number;
  durationS: number;
}

export const computeHeartRateResult = (
  peakCount: number,
  frameCount: number,
  elapsedS: number,
): HeartRateResult | null => {
  if (!elapsedS || elapsedS <= 0) return null;
  if (peakCount < 4) return null;

  const bpm = Math.round((peakCount / elapsedS) * 60);
  if (bpm < VALID_BPM_MIN || bpm > VALID_BPM_MAX) return null;

  const ratio = frameCount / (MEASURE_DURATION_S * 30);
  const confidence: HeartRateConfidence =
    ratio > 0.85 && peakCount >= 10
      ? 'high'
      : ratio > 0.6 && peakCount >= 6
      ? 'medium'
      : 'low';

  return {
    bpm,
    confidence,
    samplesUsed: frameCount,
    peaksDetected: peakCount,
    durationS: Math.round(elapsedS),
  };
};

/**
 * Save a heart rate measurement to the correct health platform.
 * ✅ Routes to HealthKit on iOS, Health Connect on Android.
 */
export const saveHeartRateToHealthPlatform = async (
  bpm: number,
  platform: HealthPlatform,
): Promise<void> => {
  if (platform === 'healthkit') return writeHeartRateHK(bpm);
  return writeHeartRateHC(bpm);
};

/** @deprecated Use `saveHeartRateToHealthPlatform` instead. */
export const saveHeartRateToHealthConnect = (bpm: number) =>
  writeHeartRateHC(bpm);

export const getHeartRateZone = (bpm: number) => {
  if (bpm < 60) return { label: 'Low', color: '#185FA5', bg: '#E6F1FB' };
  if (bpm <= 100) return { label: 'Normal', color: '#3B6D11', bg: '#EAF3DE' };
  if (bpm <= 140) return { label: 'Elevated', color: '#854F0B', bg: '#FAEEDA' };
  return { label: 'High', color: '#A32D2D', bg: '#FCEBEB' };
};

export const getConfidenceLabel = (c: HeartRateConfidence) => {
  if (c === 'high') return { text: 'High confidence', color: '#3B6D11' };
  if (c === 'medium') return { text: 'Medium confidence', color: '#854F0B' };
  return { text: 'Low confidence — retry', color: '#A32D2D' };
};
