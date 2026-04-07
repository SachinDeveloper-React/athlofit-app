import { useState, useCallback, useRef, useEffect } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import {
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import {
  saveHeartRateToHealthPlatform,
  HeartRateResult,
  MEASURE_DURATION_S,
} from '../service/heartRate.service';
import type { HealthPlatform } from './useHealth';

export type MeasurementState =
  | 'idle'
  | 'requesting_permission'
  | 'measuring'
  | 'done'
  | 'error';

const FPS = 30;
const WARMUP_FRAMES = FPS * 2;
const MEASURE_FRAMES = MEASURE_DURATION_S * FPS;
const MIN_PEAK_GAP_FRAMES = 8;
const MAX_PEAK_GAP_FRAMES = 45;
const SMOOTH_FAST = 0.2;
const SMOOTH_SLOW = 0.05;
const MIN_VALID_INTERVALS = 4;
const COVERED_THRESHOLD = 60;
const SAMPLE_BLOCK = 40;

function finalizeResult(
  intervals: number[],
  frameCount: number,
): HeartRateResult | null {
  if (intervals.length < MIN_VALID_INTERVALS) return null;

  const sorted = [...intervals].sort((a, b) => a - b);
  const trimStart = Math.floor(sorted.length * 0.1);
  const trimEnd = Math.ceil(sorted.length * 0.9);
  const trimmed = sorted.slice(trimStart, trimEnd);

  if (!trimmed.length) return null;

  const avgIntervalFrames =
    trimmed.reduce((sum, v) => sum + v, 0) / trimmed.length;
  const avgIntervalMs = (avgIntervalFrames / FPS) * 1000;

  const bpm = Math.round(60000 / avgIntervalMs);
  if (bpm < 40 || bpm > 200) return null;

  const frameRatio = frameCount / MEASURE_FRAMES;
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (trimmed.length >= 10 && frameRatio > 0.85) confidence = 'high';
  else if (trimmed.length >= 6 && frameRatio > 0.65) confidence = 'medium';

  return {
    bpm,
    confidence,
    samplesUsed: frameCount,
    peaksDetected: trimmed.length,
    durationS: Math.round(frameCount / FPS),
  };
}

export function useHeartRate(platform: HealthPlatform = 'unavailable') {
  const [measureState, setMeasureState] = useState<MeasurementState>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<HeartRateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [
    { fps: 30 },
    { videoResolution: { width: 640, height: 480 } },
  ]);

  const svRunning = useSharedValue(0);
  const svFrameCount = useSharedValue(0);
  const svCoveredCount = useSharedValue(0);
  const svUncoveredCount = useSharedValue(0);
  const svFast = useSharedValue(0);
  const svSlow = useSharedValue(0);
  const svPrevSignal = useSharedValue(0);
  const svWasAbove = useSharedValue(0);
  const svLastPeakFrame = useSharedValue(0);
  const svIntervalsJson = useSharedValue('[]');
  const svDone = useSharedValue(0);

  // Stable refs so Worklets callbacks are never recreated
  const setProgressRef = useRef(setProgress);
  const setMeasureStateRef = useRef(setMeasureState);
  const setResultRef = useRef(setResult);
  const setErrorRef = useRef(setError);

  useEffect(() => {
    setProgressRef.current = setProgress;
    setMeasureStateRef.current = setMeasureState;
    setResultRef.current = setResult;
    setErrorRef.current = setError;
  });

  // Created once — stable forever
  const onProgress = useRef(
    Worklets.createRunOnJS((p: number) => {
      setProgressRef.current(p);
    }),
  ).current;

  const onDone = useRef(
    Worklets.createRunOnJS(
      (intervalsJson: string, frameCount: number, coveredOkay: boolean) => {
        if (!coveredOkay) {
          setErrorRef.current(
            'Finger was not covering the camera properly.\n\n• Cover both lens and flash\n• Use gentle steady pressure\n• Stay still',
          );
          setMeasureStateRef.current('error');
          return;
        }

        let intervals: number[] = [];
        try {
          intervals = JSON.parse(intervalsJson);
        } catch {
          intervals = [];
        }

        const finalResult = finalizeResult(intervals, frameCount);

        if (!finalResult) {
          setErrorRef.current(
            'Could not get a clean reading.\n\n• Cover BOTH lens and flash\n• Keep your finger still\n• Avoid pressing too hard\n• Try in a darker room',
          );
          setMeasureStateRef.current('error');
          return;
        }

        setResultRef.current(finalResult);
        setProgressRef.current(1);
        setMeasureStateRef.current('done');
      },
    ),
  ).current;

  const onDebug = useRef(
    Worklets.createRunOnJS((msg: string) => {
      console.log('HR Debug:', msg);
    }),
  ).current;

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';

      if (svRunning.value === 0) return;
      if (svDone.value === 1) return;

      const buf = frame.toArrayBuffer();
      const data = new Uint8Array(buf);

      const cx = Math.floor(frame.width / 2);
      const cy = Math.floor(frame.height / 2);

      let ySum = 0;
      let count = 0;

      for (let dy = -SAMPLE_BLOCK; dy <= SAMPLE_BLOCK; dy += 2) {
        for (let dx = -SAMPLE_BLOCK; dx <= SAMPLE_BLOCK; dx += 2) {
          const px = cx + dx;
          const py = cy + dy;

          if (px < 0 || py < 0 || px >= frame.width || py >= frame.height) {
            continue;
          }

          const yIndex = py * frame.width + px;
          if (yIndex >= data.length) continue;

          ySum += data[yIndex];
          count++;
        }
      }

      if (count === 0) return;

      const avgY = ySum / count;
      const covered = avgY > COVERED_THRESHOLD;
      const currentFrame = svFrameCount.value;

      if (currentFrame % 30 === 0) {
        onDebug(
          JSON.stringify({
            svRunning: svRunning.value,
            avgY: Math.round(avgY),
            covered,
            frame: currentFrame,
            coveredCount: svCoveredCount.value,
            uncoveredCount: svUncoveredCount.value,
            intervals: svIntervalsJson.value,
            progress: Math.round((currentFrame / MEASURE_FRAMES) * 100),
          }),
        );
      }

      if (covered) {
        svCoveredCount.value += 1;
      } else {
        svUncoveredCount.value += 1;
      }

      svFrameCount.value += 1;

      if (currentFrame % 10 === 0) {
        onProgress(Math.min(currentFrame / MEASURE_FRAMES, 1));
      }

      if (!covered) {
        if (currentFrame >= MEASURE_FRAMES) {
          svDone.value = 1;
          svRunning.value = 0;
          const coveredOkay =
            svCoveredCount.value > svUncoveredCount.value &&
            svCoveredCount.value > FPS * 5;
          onDone(svIntervalsJson.value, currentFrame, coveredOkay);
        }
        return;
      }

      if (currentFrame < WARMUP_FRAMES) {
        svFast.value = avgY;
        svSlow.value = avgY;
        svPrevSignal.value = 0;
        return;
      }

      svFast.value = SMOOTH_FAST * avgY + (1 - SMOOTH_FAST) * svFast.value;
      svSlow.value = SMOOTH_SLOW * avgY + (1 - SMOOTH_SLOW) * svSlow.value;

      const signal = svFast.value - svSlow.value;
      const prev = svPrevSignal.value;

      const amplitude = Math.abs(signal);
      const dynamicThreshold = Math.max(0.05, amplitude * 0.3);

      const rising = signal > prev;
      const falling = signal < prev;

      if (signal > dynamicThreshold && rising) {
        svWasAbove.value = 1;
      }

      if (svWasAbove.value === 1 && falling) {
        const gapFrames = currentFrame - svLastPeakFrame.value;

        if (svLastPeakFrame.value === 0) {
          svLastPeakFrame.value = currentFrame;
        } else if (
          gapFrames >= MIN_PEAK_GAP_FRAMES &&
          gapFrames <= MAX_PEAK_GAP_FRAMES
        ) {
          svLastPeakFrame.value = currentFrame;

          let intervals: number[] = [];
          try {
            intervals = JSON.parse(svIntervalsJson.value);
          } catch {
            intervals = [];
          }

          intervals.push(gapFrames);
          if (intervals.length > 30) {
            intervals = intervals.slice(-30);
          }

          svIntervalsJson.value = JSON.stringify(intervals);
        }

        svWasAbove.value = 0;
      }

      svPrevSignal.value = signal;

      if (currentFrame >= MEASURE_FRAMES) {
        svDone.value = 1;
        svRunning.value = 0;
        const coveredOkay =
          svCoveredCount.value > svUncoveredCount.value &&
          svCoveredCount.value > FPS * 5;
        onDone(svIntervalsJson.value, currentFrame, coveredOkay);
      }
    },
    [onProgress, onDone, onDebug],
  );

  const startMeasurement = useCallback(async () => {
    setError(null);
    setResult(null);
    setProgress(0);
    setSaved(false);

    let granted = hasPermission;
    if (!granted) {
      setMeasureState('requesting_permission');
      granted = await requestPermission();
    }

    if (!granted) {
      setError('Camera permission is required.');
      setMeasureState('error');
      return;
    }

    if (!device) {
      setError('Back camera not available.');
      setMeasureState('error');
      return;
    }

    svFrameCount.value = 0;
    svCoveredCount.value = 0;
    svUncoveredCount.value = 0;
    svFast.value = 0;
    svSlow.value = 0;
    svPrevSignal.value = 0;
    svWasAbove.value = 0;
    svLastPeakFrame.value = 0;
    svIntervalsJson.value = '[]';
    svDone.value = 0;
    svRunning.value = 1;

    setMeasureState('measuring');
  }, [hasPermission, requestPermission, device]);

  const cancelMeasurement = useCallback(() => {
    svRunning.value = 0;
    svDone.value = 1;
    svFrameCount.value = 0;
    setMeasureState('idle');
    setProgress(0);
    setResult(null);
    setError(null);
    setSaved(false);
  }, []);

  const saveResult = useCallback(
    async (manualBpm?: number) => {
      const bpm = manualBpm ?? result?.bpm;
      if (!bpm) return;

      setIsSaving(true);
      try {
        await saveHeartRateToHealthPlatform(bpm, platform); // ✅ platform-aware
        setSaved(true);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to save');
      } finally {
        setIsSaving(false);
      }
    },
    [result, platform],
  );

  return {
    measureState,
    progress,
    result,
    error,
    isSaving,
    saved,
    device,
    format,
    hasPermission,
    frameProcessor,
    startMeasurement,
    cancelMeasurement,
    saveResult,
    reset: cancelMeasurement,
  };
}
