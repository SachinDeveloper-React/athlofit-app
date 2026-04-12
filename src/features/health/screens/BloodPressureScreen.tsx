import React, { useState, useCallback } from 'react';
import { StatusBar } from 'react-native';
import { AppView, Header, Screen } from '../../../components';
import { InputMode, ParsedBPMeasurement } from '../types/bloodpressure.types';
import { useBPReadings } from '../hooks/useBPReadings';
import { useBluetooth } from '../hooks/useBluetooth';
import { LatestReadingCard } from '../components/blood-pressure/LatestReadingCard';
import { ModeToggle } from '../components/blood-pressure/ModeToggle';
import { ManualEntryCard } from '../components/blood-pressure/ManualEntryCard';
import { DeviceCard } from '../components/blood-pressure/DeviceCard';
import { BPCategoryChart } from '../components/blood-pressure/BPCategoryChart';
import { ReadingHistory } from '../components/blood-pressure/ReadingHistory';
import { DevicePickerModal } from '../components/blood-pressure/DevicePickerModal';

export const BloodPressureScreen: React.FC = () => {
  const [mode, setMode] = useState<InputMode>('manual');

  const { readings, latestReading, addReading } = useBPReadings();

  const handleMeasurement = useCallback(
    (data: ParsedBPMeasurement, deviceName: string) => {
      addReading(
        data.systolic,
        data.diastolic,
        data.pulse,
        'device',
        deviceName,
      );
    },
    [addReading],
  );

  const {
    bleState,
    scanning,
    connecting,
    connectedDevice,
    discoveredDevices,
    showDeviceModal,
    waitingForMeasurement,
    startScan,
    connectDevice,
    disconnect,
    closeModal,
  } = useBluetooth({ onMeasurement: handleMeasurement });

  return (
    <Screen
      scroll
      safeArea={false}
      header={<Header title="Blood Pressure" bordered showBack backLabel="" />}
    >
      {/* <StatusBar barStyle="light-content" backgroundColor="#0f172a" /> */}

      {latestReading && <LatestReadingCard reading={latestReading} />}

      <ModeToggle value={mode} onChange={setMode} />

      {mode === 'manual' && (
        <ManualEntryCard
          onSubmit={(sys, dia, pls) => addReading(sys, dia, pls, 'manual')}
        />
      )}

      {mode === 'device' && (
        <DeviceCard
          bleState={bleState}
          scanning={scanning}
          connecting={connecting}
          connectedDevice={connectedDevice}
          waitingForMeasurement={waitingForMeasurement}
          onScan={startScan}
          onDisconnect={disconnect}
        />
      )}

      <BPCategoryChart />

      <ReadingHistory readings={readings} />

      <DevicePickerModal
        visible={showDeviceModal}
        scanning={scanning}
        devices={discoveredDevices}
        onSelect={connectDevice}
        onClose={closeModal}
      />
    </Screen>
  );
};

export default BloodPressureScreen;
