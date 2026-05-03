// src/features/health/service/ble.service.ts
import { Platform, PermissionsAndroid } from 'react-native';
import { BleManager, Device, State } from 'react-native-ble-plx';

export const BP_SERVICE_UUID    = '1810';
export const BP_MEASUREMENT_CHAR = '2A35';

const toFullUUID = (short: string) =>
  `0000${short}-0000-1000-8000-00805f9b34fb`;

export class BLEService {
  // ── Lazy BleManager ───────────────────────────────────────────────────────
  // NEVER create BleManager at import time or in a constructor.
  // Android's BleManager requires the Activity to be alive — it is only
  // guaranteed alive after the first render cycle completes.
  private _manager: BleManager | null = null;

  private get manager(): BleManager {
    if (!this._manager) {
      this._manager = new BleManager();
    }
    return this._manager;
  }

  // ── Reinit ────────────────────────────────────────────────────────────────
  // Destroy the old manager and create a fresh one.
  // Call this when the app returns to the foreground on Android to avoid
  // stale state after the Activity has been recreated.
  // NOTE: Do NOT eagerly access this.manager here — let the next operation
  //       create it lazily so the Activity is definitely alive.
  reinit(): void {
    try {
      this._manager?.destroy();
    } catch {
      // ignore destroy errors
    }
    this._manager = null;
  }

  // ── State subscription ────────────────────────────────────────────────────
  onStateChange(callback: (state: State) => void): { remove: () => void } {
    try {
      return this.manager.onStateChange(callback, true);
    } catch (e) {
      console.warn('[BLE] onStateChange failed:', e);
      return { remove: () => {} };
    }
  }

  // ── Permissions ───────────────────────────────────────────────────────────
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return Object.values(granted).every(
        v => v === PermissionsAndroid.RESULTS.GRANTED,
      );
    } catch (e) {
      console.warn('[BLE] requestPermissions failed:', e);
      return false;
    }
  }

  async checkPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      const results = await Promise.all([
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN),
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT),
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION),
      ]);
      return results.every(Boolean);
    } catch (e) {
      console.warn('[BLE] checkPermissions failed:', e);
      return false;
    }
  }

  // ── Scan ──────────────────────────────────────────────────────────────────
  startScan(
    onDevice: (device: Device) => void,
    onError: (error: Error) => void,
  ): void {
    try {
      this.manager.startDeviceScan(
        [toFullUUID(BP_SERVICE_UUID)],
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            onError(error);
            return;
          }
          if (device?.name) onDevice(device);
        },
      );
    } catch (e: any) {
      onError(e);
    }
  }

  stopScan(): void {
    // Guard: only call stopDeviceScan if the manager already exists.
    // Calling it on an uninitialized manager throws the "Unknown error" BleError.
    if (!this._manager) return;
    try {
      this._manager.stopDeviceScan();
    } catch {
      // ignore — scan may already be stopped
    }
  }

  // ── Connect ───────────────────────────────────────────────────────────────
  async connect(device: Device): Promise<Device> {
    const connected = await device.connect({ timeout: 10000 });
    await connected.discoverAllServicesAndCharacteristics();
    return connected;
  }

  // ── Monitor ───────────────────────────────────────────────────────────────
  monitorMeasurement(
    device: Device,
    onValue: (base64: string) => void,
  ): { remove: () => void } {
    return device.monitorCharacteristicForService(
      toFullUUID(BP_SERVICE_UUID),
      toFullUUID(BP_MEASUREMENT_CHAR),
      (err, char) => {
        if (err || !char?.value) return;
        onValue(char.value);
      },
    );
  }

  // ── Disconnect ────────────────────────────────────────────────────────────
  async disconnect(device: Device): Promise<void> {
    await device.cancelConnection().catch(() => {});
  }

  // ── Destroy ───────────────────────────────────────────────────────────────
  destroy(): void {
    this.stopScan();
    try {
      this._manager?.destroy();
    } catch {
      // ignore
    }
    this._manager = null;
  }
}
