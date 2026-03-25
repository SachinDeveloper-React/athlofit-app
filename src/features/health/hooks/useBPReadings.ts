import { useState, useCallback } from 'react';
import type { BPReading } from '../types/bloodpressure.types';
import { BPStorageService } from '../service/bpStorage.service';
import { classifyBP } from '../constants/bpClassifier.constant';
import { saveBloodPressureToHealthConnect } from '../service/bpParser.service';

export function useBPReadings() {
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

      await saveBloodPressureToHealthConnect(systolic, diastolic);
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
