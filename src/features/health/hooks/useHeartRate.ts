import { useState, useCallback, useRef, useEffect } from 'react';
import {
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from 'react-native-vision-camera';
import {
  saveHeartRateToHealthPlatform,
  HeartRateResult,
  MEASURE_DURATION_S,
} from '../service/heartRate.service';
import { usePPGHeartRate } from './usePPGHeartRate';
import type { HealthPlatform } from './useHealth';

export type MeasurementState =
  | 'idle'
  | 'requesting_permission'
  | 'measuring'
  | 'done'
  | 'error';

// How long to wait for onInitialized before force-starting measurement.
const CAMERA_INIT_TIMEOUT_MS = 4000;

export function useHeartRate(platform: HealthPlatform = 'unavailable') {
  const [measureState, setMeasureState] = useState<MeasurementState>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<HeartRateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [torchReady, setTorchReady] = useState(false);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [
    { videoResolution: { width: 640, height: 480 } },
    { fps: 15 },
  ]);

  // Use the PPG heart rate algorithm
  const {
    frameProcessor,
    bpm,
    confidence,
    isReady: ppgReady,
    fingerDetected,
    reset: ppgReset,
  } = usePPGHeartRate({ debug: __DEV__ });

  // Timer refs
  const measureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastBpmRef = useRef<number | null>(null);

  // Track the latest BPM for auto-stop
  useEffect(() => {
    lastBpmRef.current = bpm;
  }, [bpm]);

  // Progress timer: updates progress every second during measurement
  useEffect(() => {
    if (measureState === 'measuring' && torchReady) {
      startTimeRef.current = Date.now();
      measureTimerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const p = Math.min(elapsed / MEASURE_DURATION_S, 1);
        setProgress(p);

        // Auto-stop after MEASURE_DURATION_S
        if (elapsed >= MEASURE_DURATION_S) {
          finishMeasurement();
        }
      }, 500);
    }

    return () => {
      if (measureTimerRef.current) {
        clearInterval(measureTimerRef.current);
        measureTimerRef.current = null;
      }
    };
  }, [measureState, torchReady]);

  const finishMeasurement = useCallback(() => {
    if (measureTimerRef.current) {
      clearInterval(measureTimerRef.current);
      measureTimerRef.current = null;
    }

    const finalBpm = lastBpmRef.current;

    if (!finalBpm) {
      setError(
        'Could not get a clean reading.\n\n• Cover BOTH lens and flash\n• Keep your finger still\n• Avoid pressing too hard\n• Try in a darker room',
      );
      setMeasureState('error');
      return;
    }

    // Determine confidence level
    let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
    if (confidence >= 70) confidenceLevel = 'high';
    else if (confidence >= 40) confidenceLevel = 'medium';

    const finalResult: HeartRateResult = {
      bpm: finalBpm,
      confidence: confidenceLevel,
      samplesUsed: MEASURE_DURATION_S * 30,
      peaksDetected: Math.round(confidence / 12.5),
      durationS: MEASURE_DURATION_S,
    };

    setResult(finalResult);
    setProgress(1);
    setMeasureState('done');
  }, [confidence]);

  const startMeasurement = useCallback(async () => {
    setError(null);
    setResult(null);
    setProgress(0);
    setSaved(false);
    setTorchReady(false);
    ppgReset();

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

    setMeasureState('measuring');

    // Safety net: if onInitialized never fires, force torchReady
    if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
    initTimeoutRef.current = setTimeout(() => {
      setTorchReady(true);
    }, CAMERA_INIT_TIMEOUT_MS);
  }, [hasPermission, requestPermission, device, ppgReset]);

  const onTorchReady = useCallback(() => {
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
      initTimeoutRef.current = null;
    }
    setTorchReady(true);
  }, []);

  const cancelMeasurement = useCallback(() => {
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
      initTimeoutRef.current = null;
    }
    if (measureTimerRef.current) {
      clearInterval(measureTimerRef.current);
      measureTimerRef.current = null;
    }
    ppgReset();
    setMeasureState('idle');
    setProgress(0);
    setResult(null);
    setError(null);
    setSaved(false);
    setTorchReady(false);
  }, [ppgReset]);

  const saveResult = useCallback(
    async (manualBpm?: number) => {
      const bpmToSave = manualBpm ?? result?.bpm;
      if (!bpmToSave) return;

      setIsSaving(true);
      try {
        await saveHeartRateToHealthPlatform(bpmToSave, platform);
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
    torchReady,
    device,
    format,
    hasPermission,
    frameProcessor,
    startMeasurement,
    cancelMeasurement,
    onTorchReady,
    saveResult,
    reset: cancelMeasurement,
  };
}
