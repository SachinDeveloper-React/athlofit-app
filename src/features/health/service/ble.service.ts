import { Platform, PermissionsAndroid } from 'react-native';
import { BleManager, Device, State } from 'react-native-ble-plx';

export const BP_SERVICE_UUID = '1810';
export const BP_MEASUREMENT_CHAR = '2A35';

const toFullUUID = (short: string) =>
  `0000${short}-0000-1000-8000-00805f9b34fb`;

export class BLEService {
  // Lazily created — never instantiated at import time or in a constructor,
  // so the Android Activity is guaranteed to exist by the time we call new BleManager().
  private _manager: BleManager | null = null;

  private get manager(): BleManager {
    if (!this._manager) {
      this._manager = new BleManager();
    }
    return this._manager;
  }

  /**
   * Tear down the current BleManager and create a fresh one.
   * Call this when the app returns to the foreground on Android to avoid
   * stale state after the Activity has been recreated.
   */
  reinit(): void {
    this._manager?.destroy();
    this._manager = null;
    // Access the getter to eagerly create the new instance now that the
    // Activity is definitely alive again.
    void this.manager;
  }

  onStateChange(callback: (state: State) => void): { remove: () => void } {
    return this.manager.onStateChange(callback, true);
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return Object.values(granted).every(
      v => v === PermissionsAndroid.RESULTS.GRANTED,
    );
  }

  startScan(
    onDevice: (device: Device) => void,
    onError: (error: Error) => void,
  ): void {
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
  }

  stopScan(): void {
    this.manager.stopDeviceScan();
  }

  async connect(device: Device): Promise<Device> {
    const connected = await device.connect();
    await connected.discoverAllServicesAndCharacteristics();
    return connected;
  }

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

  async disconnect(device: Device): Promise<void> {
    await device.cancelConnection().catch(() => {});
  }

  destroy(): void {
    this._manager?.destroy();
    this._manager = null;
  }
}
