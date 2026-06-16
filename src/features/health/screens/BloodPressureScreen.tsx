// src/features/health/screens/BloodPressureScreen.tsx
import React from 'react';
import { AppView, Header, Screen } from '../../../components';
import { useBPReadings } from '../hooks/useBPReadings';
import { useHealthInitStore } from '../store/healthInitStore';
import { LatestReadingCard } from '../components/blood-pressure/LatestReadingCard';
import { ManualEntryCard } from '../components/blood-pressure/ManualEntryCard';
import { BPCategoryChart } from '../components/blood-pressure/BPCategoryChart';
import { ReadingHistory } from '../components/blood-pressure/ReadingHistory';

// ─── Bluetooth UI is disabled for now ─────────────────────────────────────────
// import { useState, useCallback } from 'react';
// import { InputMode, ParsedBPMeasurement } from '../types/bloodpressure.types';
// import { useBluetooth } from '../hooks/useBluetooth';
// import { ModeToggle } from '../components/blood-pressure/ModeToggle';
// import { DeviceCard } from '../components/blood-pressure/DeviceCard';
// import { DevicePickerModal } from '../components/blood-pressure/DevicePickerModal';

export const BloodPressureScreen: React.FC = () => {
  const platform = useHealthInitStore(s => s.platform);
  const { readings, latestReading, addReading } = useBPReadings(platform);

  return (
    <Screen
      scroll
      safeArea={false}
      header={<Header title="Blood Pressure" bordered showBack backLabel="" />}
    >
      {latestReading && <LatestReadingCard reading={latestReading} />}

      <AppView mt={3}>
        <ManualEntryCard
          onSubmit={(sys, dia, pls) => addReading(sys, dia, pls, 'manual')}
        />
      </AppView>

      <BPCategoryChart />
      <ReadingHistory readings={readings} />
    </Screen>
  );
};

export default BloodPressureScreen;
