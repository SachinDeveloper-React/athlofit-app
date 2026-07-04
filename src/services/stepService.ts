// src/services/stepService.ts
import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from 'react-native';

export type StepSource = 'health_connect' | 'native_sensor' | 'unavailable';

const { NativeStep } = NativeModules;
// NativeStep is Android-only; on iOS it's null, so guard against the
// Invariant Violation: `new NativeEventEmitter()` requires a non-null argument.
const stepEventEmitter = NativeStep
  ? new NativeEventEmitter(NativeStep)
  : null;

class StepService {
  private cachedSource: StepSource = 'unavailable';

  /**
   * Initialize the step service by querying the active step source.
   * Always starts the native sensor service for real-time step counting
   * (used by notification, widget, and app UI). On API 34+, Health Connect
   * remains the source for sync/history, but the native sensor provides
   * the live count so all surfaces show the same value.
   */
  async initialize(): Promise<StepSource> {
    if (!NativeStep) {
      // Native module not available (iOS) — skip initialization
      this.cachedSource = 'unavailable';
      return this.cachedSource;
    }
    try {
      const source = await NativeStep.getActiveSource();
      this.cachedSource = source as StepSource;

      // Always start the native step counter for real-time live counts,
      // regardless of whether the source is health_connect or native_sensor.
      // This ensures app, notification, and widget all show the same value.
      await this.requestPermissionAndStart();

      return this.cachedSource;
    } catch (e) {
      console.warn('[StepService] initialize failed:', e);
      this.cachedSource = 'unavailable';
      return this.cachedSource;
    }
  }

  /**
   * Request ACTIVITY_RECOGNITION permission (Android 10+) using React Native's
   * PermissionsAndroid API, then start the service.
   * On API < 29, permission is not needed and this starts immediately.
   */
  async requestPermissionAndStart(): Promise<boolean> {
    try {
      const permissionStatus = await NativeStep.getPermissionStatus();

      if (permissionStatus === 'not_required' || permissionStatus === 'granted') {
        // No permission needed or already granted — start directly
        return await NativeStep.start();
      }

      // Request permission using React Native's PermissionsAndroid (handles activity lifecycle)
      if (Platform.OS === 'android' && Platform.Version >= 29) {
        const result = await PermissionsAndroid.request(
          'android.permission.ACTIVITY_RECOGNITION' as any,
          {
            title: 'Step Counter Permission',
            message:
              'Athlofit needs access to your physical activity to count your steps accurately.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );

        if (result === PermissionsAndroid.RESULTS.GRANTED) {
          return await NativeStep.start();
        } else {
          console.warn('[StepService] ACTIVITY_RECOGNITION permission denied');
          return false;
        }
      }

      return false;
    } catch (e) {
      console.warn('[StepService] requestPermissionAndStart failed:', e);
      return false;
    }
  }

  /**
   * Start the native step counting service.
   * Requests permission first if needed.
   * Resolves true on success, false on failure.
   */
  async start(): Promise<boolean> {
    try {
      const status = await NativeStep.getPermissionStatus();
      if (status === 'denied') {
        return await this.requestPermissionAndStart();
      }
      return await NativeStep.start();
    } catch (e) {
      console.warn('[StepService] start failed:', e);
      return false;
    }
  }

  /**
   * Stop the native step counting service.
   * Resolves true on success, false on failure.
   */
  async stop(): Promise<boolean> {
    try {
      return await NativeStep.stop();
    } catch (e) {
      console.warn('[StepService] stop failed:', e);
      return false;
    }
  }

  /**
   * Get the current daily step count from the native data store.
   * Returns 0 if no data is available.
   */
  async getCurrentSteps(): Promise<number> {
    try {
      return await NativeStep.getCurrentSteps();
    } catch (e) {
      console.warn('[StepService] getCurrentSteps failed:', e);
      return 0;
    }
  }

  /**
   * Subscribe to real-time step count updates (throttled to max once per 5s).
   * Returns an unsubscribe function.
   */
  onStepUpdate(callback: (steps: number) => void): () => void {
    if (!stepEventEmitter) {
      return () => {};
    }
    const subscription = stepEventEmitter.addListener(
      'onStepUpdate',
      (event: { steps: number }) => {
        callback(event.steps);
      },
    );
    return () => subscription.remove();
  }

  /**
   * Returns the cached step source determined during initialize().
   */
  getSource(): StepSource {
    return this.cachedSource;
  }
}

export const stepService = new StepService();
