import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { Device, State } from 'react-native-ble-plx';

import type { ParsedBPMeasurement } from '../types/bloodpressure.types';
import { BLEService } from '../service/ble.service';
import { parseBPMeasurement } from '../service/bpParser.service';

interface UseBluetoothOptions {
  onMeasurement: (data: ParsedBPMeasurement, deviceName: string) => void;
}

export function useBluetooth({ onMeasurement }: UseBluetoothOptions) {
  // Stable service instance — created once, never re-created on re-render.
  // BleManager construction is deferred inside BLEService until first use,
  // so the Android Activity is always alive before new BleManager() runs.
  const serviceRef = useRef<BLEService>(new BLEService());

  const [bleState, setBleState] = useState<State>(State.Unknown);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<Device[]>([]);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [waitingForMeasurement, setWaitingForMeasurement] = useState(false);

  // Subscribe to BLE adapter state changes + clean up on unmount.
  useEffect(() => {
    const service = serviceRef.current;
    const sub = service.onStateChange(setBleState);
    return () => {
      sub.remove();
      service.destroy();
    };
  }, []);

  // On Android, the Activity can be null briefly after returning from background.
  // Reinitialising the BleManager when the app becomes active again prevents
  // the "current activity is null" crash on subsequent BLE operations.
  useEffect(() => {
    if (AppState.currentState !== 'active') return;

    const handleAppStateChange = (next: AppStateStatus) => {
      if (next === 'active') {
        serviceRef.current.reinit();
        const sub = serviceRef.current.onStateChange(setBleState);
        // Store cleanup reference so the next transition can remove it.
        return sub;
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, []);

  const startScan = useCallback(async () => {
    const service = serviceRef.current;

    if (bleState !== State.PoweredOn) {
      Alert.alert('Bluetooth Off', 'Please enable Bluetooth to scan.');
      return;
    }
    const ok = await service.requestPermissions();
    if (!ok) {
      Alert.alert('Permission denied', 'Bluetooth permissions are required.');
      return;
    }

    setDiscoveredDevices([]);
    setScanning(true);
    setShowDeviceModal(true);

    service.startScan(
      device =>
        setDiscoveredDevices(prev =>
          prev.find(d => d.id === device.id) ? prev : [...prev, device],
        ),
      error => {
        console.error(error);
        setScanning(false);
      },
    );

    setTimeout(() => {
      service.stopScan();
      setScanning(false);
    }, 10_000);
  }, [bleState]);

  const connectDevice = useCallback(
    async (device: Device) => {
      const service = serviceRef.current;

      setShowDeviceModal(false);
      service.stopScan();
      setConnecting(true);

      try {
        const connected = await service.connect(device);
        setConnectedDevice(connected);

        service.monitorMeasurement(connected, base64 => {
          const parsed = parseBPMeasurement(base64);
          if (!parsed) return;
          setWaitingForMeasurement(false);
          onMeasurement(parsed, device.name ?? 'BLE Device');
        });

        setWaitingForMeasurement(true);
        Alert.alert(
          'Connected!',
          `${device.name} – take a measurement on your device.`,
        );
      } catch (e: any) {
        Alert.alert('Connection failed', e.message ?? 'Unknown error');
      } finally {
        setConnecting(false);
      }
    },
    [onMeasurement],
  );

  const disconnect = useCallback(async () => {
    if (!connectedDevice) return;
    await serviceRef.current.disconnect(connectedDevice);
    setConnectedDevice(null);
    setWaitingForMeasurement(false);
  }, [connectedDevice]);

  const closeModal = useCallback(() => {
    setShowDeviceModal(false);
    serviceRef.current.stopScan();
    setScanning(false);
  }, []);

  return {
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
  };
}
