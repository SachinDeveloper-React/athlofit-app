import { useState, useCallback } from 'react';
import type { BPReading } from '../types/bloodpressure.types';
import { BPStorageService } from '../service/bpStorage.service';
import { classifyBP } from '../constants/bpClassifier.constant';
import { saveBloodPressureToHealthPlatform } from '../service/bpParser.service';
import type { HealthPlatform } from './useHealth';

export function useBPReadings(platform: HealthPlatform = 'unavailable') {
  const [readings, setReadings] = useState<BPReading[]>(() =>
    BPStorageService.load(),
  );

  const latestReading = readings[0] ?? null;

  const addReading = useCallback(
    async (
      systolic: number,
      diastolic: number,
      pulse: number | undefined,
      source: 'manual' | 'device',
      deviceName?: string,
    ) => {
      const reading: BPReading = {
        id: Date.now().toString(),
        systolic,
        diastolic,
        pulse,
        timestamp: new Date(),
        source,
        deviceName,
        category: classifyBP(systolic, diastolic),
      };

      await saveBloodPressureToHealthPlatform(systolic, diastolic, platform); // ✅ platform-aware
      setReadings(prev => {
        const updated = [reading, ...prev];
        BPStorageService.save(updated);
        return updated;
      });
    },
    [],
  );

  return { readings, latestReading, addReading };
}
