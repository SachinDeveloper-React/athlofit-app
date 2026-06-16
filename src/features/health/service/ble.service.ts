// src/features/health/service/ble.service.ts
import { Platform, PermissionsAndroid } from 'react-native';
import { BleManager, Device, State, Service } from 'react-native-ble-plx';

export const BP_SERVICE_UUID    = '1810';
export const BP_MEASUREMENT_CHAR = '2A35';

// Heart Rate service (most fitness watches support this)
export const HR_SERVICE_UUID    = '180D';
export const HR_MEASUREMENT_CHAR = '2A37';

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

  // ── State subscription ────────────────────────────────────────────────────
  onStateChange(callback: (state: State) => void): { remove: () => void } {
    try {
      return this.manager.onStateChange(callback, true);
    } catch (e: any) {
      // If manager was destroyed between operations, fail gracefully
      if (e?.message?.includes('destroyed')) {
        console.warn('[BLE] Manager destroyed — skipping onStateChange');
        return { remove: () => {} };
      }
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
  /**
   * Scan for nearby BLE devices.
   * @param serviceUUIDs - Optional array of service UUIDs to filter.
   *   Pass null to scan ALL nearby BLE devices (needed for proprietary devices
   *   like NoiseFit, Boat, Fire-Boltt that don't advertise standard BP service).
   */
  startScan(
    onDevice: (device: Device) => void,
    onError: (error: Error) => void,
    serviceUUIDs: string[] | null = null,
  ): void {
    try {
      this.manager.startDeviceScan(
        serviceUUIDs,
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            if ((error as any)?.message?.includes('destroyed')) return;
            onError(error);
            return;
          }
          // Show devices that have a name (skip unnamed beacons/peripherals)
          if (device?.name || device?.localName) onDevice(device);
        },
      );
    } catch (e: any) {
      if (e?.message?.includes('destroyed')) return;
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
    try {
      const connected = await device.connect({ timeout: 10000 });
      await connected.discoverAllServicesAndCharacteristics();
      return connected;
    } catch (e: any) {
      if (e?.message?.includes('destroyed')) {
        throw new Error('Bluetooth was reset. Please try again.');
      }
      throw e;
    }
  }

  // ── Monitor BP ─────────────────────────────────────────────────────────────
  monitorMeasurement(
    device: Device,
    onValue: (base64: string) => void,
  ): { remove: () => void } {
    try {
      return device.monitorCharacteristicForService(
        toFullUUID(BP_SERVICE_UUID),
        toFullUUID(BP_MEASUREMENT_CHAR),
        (err, char) => {
          if (err) {
            if ((err as any)?.message?.includes('destroyed')) return;
            console.warn('[BLE] Monitor BP error:', err.message);
            return;
          }
          if (!char?.value) return;
          onValue(char.value);
        },
      );
    } catch (e: any) {
      console.warn('[BLE] monitorMeasurement failed:', e?.message);
      return { remove: () => {} };
    }
  }

  // ── Monitor Heart Rate ────────────────────────────────────────────────────
  monitorHeartRate(
    device: Device,
    onValue: (base64: string) => void,
  ): { remove: () => void } {
    try {
      return device.monitorCharacteristicForService(
        toFullUUID(HR_SERVICE_UUID),
        toFullUUID(HR_MEASUREMENT_CHAR),
        (err, char) => {
          if (err) {
            if ((err as any)?.message?.includes('destroyed')) return;
            console.warn('[BLE] Monitor HR error:', err.message);
            return;
          }
          if (!char?.value) return;
          onValue(char.value);
        },
      );
    } catch (e: any) {
      console.warn('[BLE] monitorHeartRate failed:', e?.message);
      return { remove: () => {} };
    }
  }

  // ── Discover services ─────────────────────────────────────────────────────
  /**
   * Check which standard health services the connected device supports.
   */
  async getAvailableServices(device: Device): Promise<{
    hasBloodPressure: boolean;
    hasHeartRate: boolean;
    serviceUUIDs: string[];
  }> {
    try {
      const services = await device.services();
      const uuids = services.map(s => s.uuid.toLowerCase());

      return {
        hasBloodPressure: uuids.includes(toFullUUID(BP_SERVICE_UUID)),
        hasHeartRate: uuids.includes(toFullUUID(HR_SERVICE_UUID)),
        serviceUUIDs: uuids,
      };
    } catch (e: any) {
      console.warn('[BLE] getAvailableServices failed:', e?.message);
      return { hasBloodPressure: false, hasHeartRate: false, serviceUUIDs: [] };
    }
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
