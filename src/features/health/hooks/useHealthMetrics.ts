// src/features/health/hooks/useHealthMetrics.ts
// ─── Platform-aware hook: reads weight & height from Health Connect / HealthKit ─

import { useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

export interface HealthMetrics {
  weight: number | null;   // kg
  height: number | null;   // m
  source: 'health_connect' | 'healthkit' | 'none';
}

interface UseHealthMetricsResult extends HealthMetrics {
  isLoading: boolean;
  permissionDenied: boolean;
  error: string | null;
  refresh: () => void;
}

// ─── Android (Health Connect) ─────────────────────────────────────────────────

async function readAndroid(): Promise<HealthMetrics> {
  const {
    initialize,
    requestPermission,
    readRecords,
  } = require('react-native-health-connect');

  const initialized = await initialize();
  if (!initialized) throw new Error('Health Connect not available');

  const granted = await requestPermission([
    { accessType: 'read', recordType: 'Weight' },
    { accessType: 'read', recordType: 'Height' },
  ]);

  if (!granted || granted.length === 0) throw new Error('PERMISSION_DENIED');

  const now = new Date();
  const past = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days back

  const timeRangeFilter = {
    operator: 'between',
    startTime: past.toISOString(),
    endTime:   now.toISOString(),
  };

  const [weightRes, heightRes] = await Promise.all([
    readRecords('Weight', { timeRangeFilter }),
    readRecords('Height', { timeRangeFilter }),
  ]);

  const latestWeight =
    weightRes?.records?.slice(-1)[0]?.weight?.inKilograms ?? null;
  const latestHeight =
    heightRes?.records?.slice(-1)[0]?.height?.inMeters ?? null;

  return { weight: latestWeight, height: latestHeight, source: 'health_connect' };
}

// ─── iOS (HealthKit) ──────────────────────────────────────────────────────────

async function readIOS(): Promise<HealthMetrics> {
  const AppleHealthKit = require('react-native-health').default;

  const PERMS = (AppleHealthKit as any).Constants.Permissions;

  const permissions = {
    permissions: {
      read: [PERMS.Weight, PERMS.Height],
      write: [],
    },
  };

  await new Promise<void>((resolve, reject) => {
    AppleHealthKit.initHealthKit(permissions, (err: Error) => {
      if (err) reject(new Error('PERMISSION_DENIED'));
      else resolve();
    });
  });

  const [weightResult, heightResult] = await Promise.all([
    new Promise<number | null>((resolve) => {
      AppleHealthKit.getLatestWeight({}, (err: Error, result: { value: number }) => {
        resolve(err || !result ? null : result.value * 0.453592); // lb → kg
      });
    }),
    new Promise<number | null>((resolve) => {
      AppleHealthKit.getLatestHeight({}, (err: Error, result: { value: number }) => {
        resolve(err || !result ? null : result.value * 0.0254); // inches → m
      });
    }),
  ]);

  return {
    weight: weightResult,
    height: heightResult,
    source: 'healthkit',
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useHealthMetrics(): UseHealthMetricsResult {
  const [state, setState] = useState<{
    weight: number | null;
    height: number | null;
    source: HealthMetrics['source'];
    isLoading: boolean;
    permissionDenied: boolean;
    error: string | null;
  }>({
    weight: null,
    height: null,
    source: 'none',
    isLoading: false,
    permissionDenied: false,
    error: null,
  });

  const read = useCallback(async () => {
    setState(s => ({ ...s, isLoading: true, error: null }));
    try {
      const result =
        Platform.OS === 'android' ? await readAndroid() : await readIOS();
      setState(s => ({
        ...s,
        ...result,
        isLoading: false,
        permissionDenied: false,
        error: null,
      }));
    } catch (err: any) {
      const denied = err?.message === 'PERMISSION_DENIED';
      setState(s => ({
        ...s,
        isLoading: false,
        permissionDenied: denied,
        error: denied
          ? null
          : (err?.message ?? 'Failed to read health data'),
      }));
    }
  }, []);

  // Auto-read on mount
  useEffect(() => { read(); }, [read]);

  return { ...state, refresh: read };
}
