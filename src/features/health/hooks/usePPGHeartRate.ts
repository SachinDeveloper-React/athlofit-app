import { useRef, useState, useCallback } from 'react';
import { useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';

const SAMPLE_RATE = 30;
const WINDOW_SECONDS = 6;
const BUFFER_SIZE = SAMPLE_RATE * WINDOW_SECONDS;
const MIN_BPM = 40;
const MAX_BPM = 180;

const FINGER_MIN = 80;
const FINGER_MAX = 254;
const MIN_VAR = 0.05;
const MAX_VAR = 5000;

// ─── Utils ─────────────────────────────────────────────────────
function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr: number[]): number {
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
}

// ─── Bandpass: detrend → smooth → normalize ────────────────────
function bandpass(signal: number[]): number[] {
  // Detrend: remove slow baseline drift
  const detrended = signal.map((v, i) => {
    const w = signal.slice(Math.max(0, i - 60), i + 1);
    return v - mean(w);
  });

  // Smooth: 5-point moving average
  const smoothed = detrended.map((_, i) => {
    const w = detrended.slice(Math.max(0, i - 5), i + 1);
    return mean(w);
  });

  // Normalize to [-1, +1]
  const maxAbs = Math.max(...smoothed.map(Math.abs));
  if (maxAbs === 0) return smoothed;
  return smoothed.map(v => v / maxAbs);
}

// ─── Peak detection on normalized signal ───────────────────────
function findPeaks(signal: number[]): number[] {
  const minGap = Math.round(SAMPLE_RATE * 60 / MAX_BPM);
  const peaks: number[] = [];

  for (let i = 2; i < signal.length - 2; i++) {
    const isLocalMax =
      signal[i] >= signal[i - 1] &&
      signal[i] >= signal[i - 2] &&
      signal[i] >= signal[i + 1] &&
      signal[i] >= signal[i + 2];

    const aboveThreshold = signal[i] > 0.3;
    const farEnough = !peaks.length || (i - peaks[peaks.length - 1]) >= minGap;

    if (isLocalMax && aboveThreshold && farEnough) peaks.push(i);
  }

  return peaks;
}

// ─── Convert peaks → BPM, filtering bad intervals ──────────────
function peaksToBpm(peaks: number[]): number | null {
  if (peaks.length < 2) return null;

  const minGap = Math.round(SAMPLE_RATE * 60 / MAX_BPM);
  const maxGap = Math.round(SAMPLE_RATE * 60 / MIN_BPM);

  const validGaps: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    const g = peaks[i] - peaks[i - 1];
    if (g >= minGap && g <= maxGap) validGaps.push(g);
  }

  if (!validGaps.length) return null;

  const bpm = Math.round(60 * SAMPLE_RATE / mean(validGaps));
  return bpm >= MIN_BPM && bpm <= MAX_BPM ? bpm : null;
}

// ─── Main Hook ─────────────────────────────────────────────────
export function usePPGHeartRate({ debug = false } = {}) {
  const buf = useRef<number[]>([]);
  const frameN = useRef(0);
  const logTick = useRef(0);

  const [bpm, setBpm] = useState<number | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [brightness, setBrightness] = useState(0);
  const [fingerDetected, setFingerDetected] = useState(false);
  const [signalVar, setSignalVar] = useState(0);

  const onFrame = Worklets.createRunOnJS((avg: number, fmt: string) => {
    setBrightness(Math.round(avg));

    // Debug log every 1 sec
    if (debug) {
      logTick.current++;
      if (logTick.current % SAMPLE_RATE === 0) {
        const v = buf.current.length > 10 ? variance(buf.current).toFixed(3) : 'n/a';
        console.log(`[PPG] fmt=${fmt} brightness=${avg.toFixed(1)} var=${v} buf=${buf.current.length}`);
      }
    }

    // Finger check
    const finger = avg >= FINGER_MIN && avg <= FINGER_MAX;
    setFingerDetected(finger);

    if (!finger) {
      buf.current = [];
      frameN.current = 0;
      setBpm(null);
      setConfidence(0);
      setIsReady(false);
      setSignalVar(0);
      return;
    }

    // Buffer
    buf.current.push(avg);
    if (buf.current.length > BUFFER_SIZE) buf.current.shift();
    frameN.current++;

    // Need 3 sec minimum
    if (buf.current.length < SAMPLE_RATE * 3) return;

    setIsReady(true);

    // Variance gate
    const v = variance(buf.current);
    setSignalVar(parseFloat(v.toFixed(3)));

    if (v < MIN_VAR || v > MAX_VAR) {
      if (debug) console.log(`[PPG] variance gated: ${v.toFixed(3)}`);
      return;
    }

    // Compute every 15 frames (~0.5 sec)
    if (frameN.current % 15 !== 0) return;

    const filtered = bandpass(buf.current);
    const peaks = findPeaks(filtered);
    const result = peaksToBpm(peaks);

    if (debug) console.log(`[PPG] peaks=${peaks.length} result=${result}`);

    if (result) {
      setBpm(result);
      setConfidence(Math.min(100, Math.round((peaks.length / 8) * 100)));
    }
  });

  // Frame processor
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    try {
      const buffer = frame.toArrayBuffer();
      const bytes = new Uint8Array(buffer);
      const w = frame.width;
      const h = frame.height;
      const fmt = frame.pixelFormat;
      const cx = Math.floor(w / 2);
      const cy = Math.floor(h / 2);
      const r = 30;

      let sum = 0, n = 0;

      if (fmt === 'rgb') {
        for (let y = cy - r; y < cy + r; y += 2) {
          for (let x = cx - r; x < cx + r; x += 2) {
            const i = (y * w + x) * 4;
            sum += (bytes[i] + bytes[i + 1] + bytes[i + 2]) / 3;
            n++;
          }
        }
      } else {
        // YUV: Y plane = first w*h bytes
        for (let y = cy - r; y < cy + r; y += 2) {
          for (let x = cx - r; x < cx + r; x += 2) {
            sum += bytes[y * w + x];
            n++;
          }
        }
      }

      onFrame(n > 0 ? sum / n : 0, fmt);
    } catch (_) {}
  }, [onFrame]);

  const reset = useCallback(() => {
    buf.current = [];
    frameN.current = 0;
    setBpm(null);
    setConfidence(0);
    setIsReady(false);
    setBrightness(0);
    setFingerDetected(false);
    setSignalVar(0);
  }, []);

  return {
    frameProcessor,
    bpm,
    confidence,
    isReady,
    brightness,
    fingerDetected,
    signalVar,
    reset,
  };
}
