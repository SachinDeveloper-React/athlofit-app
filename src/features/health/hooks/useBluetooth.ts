// src/features/health/hooks/useBluetooth.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { Device, State } from 'react-native-ble-plx';

import type { ParsedBPMeasurement } from '../types/bloodpressure.types';
import { BLEService } from '../service/ble.service';
import { parseBPMeasurement } from '../service/bpParser.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BluetoothPermissionStatus =
  | 'unknown'       // not yet checked
  | 'granted'       // all permissions granted
  | 'denied'        // user denied one or more permissions
  | 'unavailable';  // BT not available on this device

interface UseBluetoothOptions {
  onMeasurement: (data: ParsedBPMeasurement, deviceName: string) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBluetooth({ onMeasurement }: UseBluetoothOptions) {
  // ── Lazy ref — BLEService is created only on first render, not at import ──
  // Using a function initializer ensures new BLEService() runs inside the
  // component lifecycle (Activity is alive), not at module evaluation time.
  const serviceRef = useRef<BLEService | null>(null);
  const getService = useCallback((): BLEService => {
    if (!serviceRef.current) {
      serviceRef.current = new BLEService();
    }
    return serviceRef.current;
  }, []);

  // Scan timeout ref so we can clear it on unmount
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [bleState,              setBleState]              = useState<State>(State.Unknown);
  const [permissionStatus,      setPermissionStatus]      = useState<BluetoothPermissionStatus>('unknown');
  const [scanning,              setScanning]              = useState(false);
  const [connecting,            setConnecting]            = useState(false);
  const [connectedDevice,       setConnectedDevice]       = useState<Device | null>(null);
  const [discoveredDevices,     setDiscoveredDevices]     = useState<Device[]>([]);
  const [showDeviceModal,       setShowDeviceModal]       = useState(false);
  const [waitingForMeasurement, setWaitingForMeasurement] = useState(false);

  // ── BLE adapter state subscription ───────────────────────────────────────
  // Deferred to useEffect so the Activity is alive before BleManager is created.
  useEffect(() => {
    const service = getService();
    const sub = service.onStateChange(setBleState);
    return () => {
      sub.remove();
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      service.destroy();
      serviceRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Check permissions on mount (no prompt) ───────────────────────────────
  useEffect(() => {
    if (Platform.OS === 'ios') {
      setPermissionStatus('granted');
      return;
    }
    getService()
      .checkPermissions()
      .then(granted => setPermissionStatus(granted ? 'granted' : 'unknown'))
      .catch(() => setPermissionStatus('unknown'));
  }, [getService]);

  // ── Request permissions ───────────────────────────────────────────────────
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const granted = await getService().requestPermissions();
      setPermissionStatus(granted ? 'granted' : 'denied');
      return granted;
    } catch (e) {
      console.warn('[useBluetooth] requestPermissions error:', e);
      setPermissionStatus('denied');
      return false;
    }
  }, [getService]);

  // ── Start scan ────────────────────────────────────────────────────────────
  const startScan = useCallback(async () => {
    if (bleState !== State.PoweredOn) {
      Alert.alert(
        'Bluetooth Off',
        'Please enable Bluetooth in your device settings to scan for devices.',
      );
      return;
    }

    // Request permissions if not yet granted
    if (permissionStatus !== 'granted') {
      const ok = await requestPermissions();
      if (!ok) return; // DeviceCard shows the permission UI
    }

    setDiscoveredDevices([]);
    setScanning(true);
    setShowDeviceModal(true);

    getService().startScan(
      device =>
        setDiscoveredDevices(prev =>
          prev.find(d => d.id === device.id) ? prev : [...prev, device],
        ),
      error => {
        // Swallow the "Unknown error" that fires when scan is stopped normally
        const msg = (error as any)?.message ?? '';
        if (!msg.toLowerCase().includes('unknown error')) {
          console.warn('[BLE] Scan error:', error);
        }
        setScanning(false);
      },
    );

    // Auto-stop after 15 seconds
    scanTimeoutRef.current = setTimeout(() => {
      getService().stopScan();
      setScanning(false);
    }, 15_000);
  }, [bleState, permissionStatus, requestPermissions, getService]);

  // ── Connect to device ─────────────────────────────────────────────────────
  const connectDevice = useCallback(
    async (device: Device) => {
      setShowDeviceModal(false);
      getService().stopScan();
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      setScanning(false);
      setConnecting(true);

      try {
        const connected = await getService().connect(device);
        setConnectedDevice(connected);

        // Discover what services this device actually supports
        const services = await getService().getAvailableServices(connected);
        const deviceName = device.name || device.localName || 'BLE Device';

        if (services.hasBloodPressure) {
          // Standard BP monitor — subscribe to BP measurements
          getService().monitorMeasurement(connected, base64 => {
            const parsed = parseBPMeasurement(base64);
            if (!parsed) return;
            setWaitingForMeasurement(false);
            onMeasurement(parsed, deviceName);
          });

          setWaitingForMeasurement(true);
          Alert.alert(
            'Connected!',
            `${deviceName} supports blood pressure monitoring. Start a measurement on your device.`,
          );
        } else if (services.hasHeartRate) {
          // Fitness watch with HR — inform user about limitations
          setWaitingForMeasurement(false);
          Alert.alert(
            'Connected!',
            `${deviceName} connected successfully.\n\nThis device supports Heart Rate but not direct Blood Pressure readings via Bluetooth.\n\nFor BP data, use the manual entry or sync through Health Connect (your watch app writes to Health Connect → Athlofit reads it automatically).`,
          );
        } else {
          // Proprietary device — no standard health services
          setWaitingForMeasurement(false);
          Alert.alert(
            'Connected!',
            `${deviceName} connected, but it doesn't expose standard health services via Bluetooth.\n\nFor BP data from this watch, use the manual entry or ensure your watch syncs to Health Connect through its companion app (e.g., NoiseFit app).`,
          );
        }
      } catch (e: any) {
        const msg = e?.message ?? 'Could not connect to device.';
        Alert.alert('Connection Failed', msg);
      } finally {
        setConnecting(false);
      }
    },
    [onMeasurement, getService],
  );

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    if (!connectedDevice) return;
    await getService().disconnect(connectedDevice);
    setConnectedDevice(null);
    setWaitingForMeasurement(false);
  }, [connectedDevice, getService]);

  // ── Close modal ───────────────────────────────────────────────────────────
  const closeModal = useCallback(() => {
    setShowDeviceModal(false);
    getService().stopScan();
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setScanning(false);
  }, [getService]);

  return {
    bleState,
    permissionStatus,
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
    requestPermissions,
  };
}
