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
    if (!NativeStep) {
      return false;
    }
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
    if (!NativeStep) {
      return false;
    }
    try {
      return await NativeStep.stop();
    } catch (e) {
      console.warn('[StepService] stop failed:', e);
      return false;
    }
  }

  /**
   * Mirror the server's step-tracking kill switch into the native layer.
   *
   * Must be called on every state change, not just on stop(): the foreground
   * service, the keep-alive worker, the widget worker and the EOD alarm are all
   * restarted by Android without any React context, so a JS-only flag is
   * overridden minutes later. The native side keeps its own copy in
   * SharedPreferences and refuses to start or sync while it is set.
   *
   * No-op on iOS, where there is no native step service.
   */
  async setTrackingEnabled(enabled: boolean, reason?: string | null): Promise<boolean> {
    if (!NativeStep?.setStepTrackingEnabled) {
      return false;
    }
    try {
      return await NativeStep.setStepTrackingEnabled(enabled, reason ?? '');
    } catch (e) {
      console.warn('[StepService] setTrackingEnabled failed:', e);
      return false;
    }
  }

  /**
   * Tell the native layer that the running BUILD is barred from submitting
   * steps.
   *
   * Distinct from setTrackingEnabled(false): native stores the blocked version
   * string and compares it against BuildConfig, so the block clears itself when
   * the user installs an update. Recording a build block as an account pause
   * would instead leave the device disabled after updating.
   */
  async setVersionBlocked(reason?: string | null): Promise<boolean> {
    if (!NativeStep?.setStepVersionBlocked) {
      return false;
    }
    try {
      return await NativeStep.setStepVersionBlocked(reason ?? '');
    } catch (e) {
      console.warn('[StepService] setVersionBlocked failed:', e);
      return false;
    }
  }

  /**
   * Read the native-side kill-switch state.
   *
   * The native flag and the JS store are written independently — a 403 landing
   * in a WorkManager job sets only the native one — so on launch the app should
   * treat "disabled" from either side as authoritative.
   */
  async getNativeTrackingState(): Promise<{ enabled: boolean; reason: string } | null> {
    if (!NativeStep?.isStepTrackingEnabled) {
      return null;
    }
    try {
      return await NativeStep.isStepTrackingEnabled();
    } catch (e) {
      console.warn('[StepService] getNativeTrackingState failed:', e);
      return null;
    }
  }

  /**
   * Get the current daily step count from the native data store.
   * Returns 0 if no data is available or if the native module is not present (iOS).
   */
  async getCurrentSteps(): Promise<number> {
    if (!NativeStep) {
      return 0;
    }
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
   * Triggers a midnight reset on the native step service.
   * Called from JS when midnight passes while the app is open, ensuring
   * the native notification and widget reset even if AlarmManager is delayed.
   */
  async triggerMidnightReset(): Promise<boolean> {
    if (!NativeStep) {
      return false;
    }
    try {
      return await NativeStep.triggerMidnightReset();
    } catch (e) {
      console.warn('[StepService] triggerMidnightReset failed:', e);
      return false;
    }
  }

  /**
   * Sets a server step floor for the native service.
   * After re-login, ensures the notification and widget never show fewer steps
   * than the server's recorded count for today. If the server has more steps
   * than the native sensor has counted, the difference is injected so all
   * surfaces (app, notification, widget) display at least the server value.
   *
   * @param serverSteps The server's step count for today
   * @returns true if the floor was applied (native < server), false otherwise
   */
  async setServerStepFloor(serverSteps: number): Promise<boolean> {
    if (!NativeStep) {
      return false;
    }
    try {
      return await NativeStep.setServerStepFloor(serverSteps);
    } catch (e) {
      console.warn('[StepService] setServerStepFloor failed:', e);
      return false;
    }
  }

  /**
   * Forces an immediate update of the notification and widget with the given
   * step count. Call this when the app has a fresher value (e.g., from Health
   * Connect or the server) than what the native sensor has accumulated.
   *
   * Only applies if steps > current native live count, so it never overwrites
   * a more recent sensor reading with a stale value.
   *
   * @param steps Fresh step count to push to notification and widget
   * @returns true if the update was applied, false if native already had a higher value
   */
  async forceRefreshSteps(steps: number): Promise<boolean> {
    if (!NativeStep) {
      return false;
    }
    try {
      return await NativeStep.forceRefreshSteps(steps);
    } catch (e) {
      console.warn('[StepService] forceRefreshSteps failed:', e);
      return false;
    }
  }

  /**
   * Corrects inflated native step count caused by the circular HC write bug.
   * If the native service has a persisted dailySteps significantly higher than
   * the actual Health Connect platform sensor reading, this resets the inflated
   * rebootOffset so the native service reports the correct value.
   *
   * @param correctSteps The actual correct step count (from HC external sources)
   * @returns true if correction was applied
   */
  async correctInflatedSteps(correctSteps: number): Promise<boolean> {
    if (!NativeStep) {
      return false;
    }
    try {
      return await NativeStep.correctInflatedSteps(correctSteps);
    } catch (e) {
      console.warn('[StepService] correctInflatedSteps failed:', e);
      return false;
    }
  }

  /**
   * Returns the cached step source determined during initialize().
   */
  getSource(): StepSource {
    return this.cachedSource;
  }

  /**
   * Returns the current ACTIVITY_RECOGNITION permission status.
   * - 'granted': permission is granted, native sensor can run
   * - 'denied': user denied the permission
   * - 'not_required': device doesn't need it (API < 29)
   * On iOS or if the native module is unavailable, returns 'not_required'.
   */
  async getActivityPermissionStatus(): Promise<'granted' | 'denied' | 'not_required'> {
    if (!NativeStep || Platform.OS !== 'android') {
      return 'not_required';
    }
    try {
      const status = await NativeStep.getPermissionStatus();
      return status as 'granted' | 'denied' | 'not_required';
    } catch (e) {
      console.warn('[StepService] getActivityPermissionStatus failed:', e);
      return 'not_required';
    }
  }

  /**
   * Returns the native step service debug log for production debugging.
   */
  async getDebugLog(): Promise<string> {
    if (!NativeStep) {
      return '(NativeStep not available)';
    }
    try {
      return await NativeStep.getStepDebugLog();
    } catch (e) {
      return `Error: ${e}`;
    }
  }

  // ─── Battery Optimization ─────────────────────────────────────────────────

  /**
   * Checks if the app is exempt from Android's battery optimization (Doze mode).
   * Returns true if already whitelisted or if check is not applicable (iOS).
   */
  async isIgnoringBatteryOptimizations(): Promise<boolean> {
    if (!NativeStep) {
      return true; // iOS — not applicable
    }
    try {
      return await NativeStep.isIgnoringBatteryOptimizations();
    } catch (e) {
      console.warn('[StepService] isIgnoringBatteryOptimizations failed:', e);
      return true; // Fail safe
    }
  }

  /**
   * Opens the system dialog to request battery optimization exemption.
   * Shows Android's built-in "Allow app to run in background?" prompt.
   */
  async requestDisableBatteryOptimization(): Promise<boolean> {
    if (!NativeStep) {
      return false;
    }
    try {
      return await NativeStep.requestDisableBatteryOptimization();
    } catch (e) {
      console.warn('[StepService] requestDisableBatteryOptimization failed:', e);
      return false;
    }
  }

  /**
   * Opens the system battery optimization settings page.
   * Fallback for OEMs where the direct dialog doesn't work.
   */
  async openBatterySettings(): Promise<boolean> {
    if (!NativeStep) {
      return false;
    }
    try {
      return await NativeStep.openBatterySettings();
    } catch (e) {
      console.warn('[StepService] openBatterySettings failed:', e);
      return false;
    }
  }

  // ─── Diagnostics ──────────────────────────────────────────────────────────

  /**
   * Returns comprehensive diagnostic data for debugging step counting issues.
   * Includes device info, permission status, sensor details, service state,
   * battery optimization, and the native debug log.
   *
   * Use this when steps are not increasing on specific devices (e.g., Android 10).
   */
  async getDiagnostics(): Promise<StepDiagnostics | null> {
    if (!NativeStep) {
      return null;
    }
    try {
      return await NativeStep.getDiagnostics();
    } catch (e) {
      console.warn('[StepService] getDiagnostics failed:', e);
      return null;
    }
  }

  /**
   * Fetches diagnostics and logs a formatted summary to the console.
   * Call this from a debug screen or when investigating step issues on a device.
   *
   * Returns the raw diagnostics object for further inspection.
   */
  async logDiagnostics(): Promise<StepDiagnostics | null> {
    const diag = await this.getDiagnostics();
    if (!diag) {
      console.warn('[StepService] Diagnostics unavailable (iOS or native module missing)');
      return null;
    }

    const lines: string[] = [
      '═══════════════════════════════════════════════════',
      '       STEP SERVICE DIAGNOSTICS',
      '═══════════════════════════════════════════════════',
      '',
      '── Device ──',
      `  API Level: ${diag.device?.apiLevel} (Android ${diag.device?.androidVersion})`,
      `  Manufacturer: ${diag.device?.manufacturer}`,
      `  Model: ${diag.device?.model}`,
      `  Brand: ${diag.device?.brand}`,
      `  Hardware: ${diag.device?.hardware}`,
      `  Board: ${diag.device?.board}`,
      `  SoC: ${diag.device?.soc}`,
      '',
      '── Permission ──',
      `  ACTIVITY_RECOGNITION required: ${diag.permission?.activityRecognitionRequired}`,
      `  ACTIVITY_RECOGNITION granted: ${diag.permission?.activityRecognitionGranted}`,
      `  Status: ${diag.permission?.permissionStatus}`,
      `  Retry count: ${diag.permission?.retryCount}`,
      `  Retry exhausted: ${diag.permission?.retryExhausted}`,
      '',
      '── Sensor ──',
      `  SensorManager available: ${diag.sensor?.sensorManagerAvailable}`,
      `  TYPE_STEP_COUNTER available: ${diag.sensor?.stepCounterAvailable}`,
      `  TYPE_STEP_DETECTOR available: ${diag.sensor?.stepDetectorAvailable}`,
      `  Sensor name: ${diag.sensor?.sensorName ?? 'N/A'}`,
      `  Sensor vendor: ${diag.sensor?.sensorVendor ?? 'N/A'}`,
      `  Wake-up sensor: ${diag.sensor?.isWakeUpSensor ?? 'N/A'}`,
      `  FIFO max: ${diag.sensor?.fifoMaxCount ?? 'N/A'}`,
      `  FIFO reserved: ${diag.sensor?.fifoReservedCount ?? 'N/A'}`,
      '',
      '── Service ──',
      `  Running: ${diag.service?.serviceRunning}`,
      `  Live step count: ${diag.service?.liveStepCount}`,
      `  Display step floor: ${diag.service?.displayStepFloor}`,
      `  Source: ${diag.service?.source}`,
      `  Sensor events received: ${diag.service?.sensorEventCount}`,
      `  Seconds since last sensor event: ${diag.service?.secondsSinceLastSensorEvent}`,
      '',
      '── Step State (SharedPreferences) ──',
      `  Baseline: ${diag.stepState?.baseline}`,
      `  Daily steps: ${diag.stepState?.dailySteps}`,
      `  Reboot offset: ${diag.stepState?.rebootOffset}`,
      `  Stored date: ${diag.stepState?.storedDate}`,
      `  Last cumulative: ${diag.stepState?.lastCumulative}`,
      '',
      '── Battery ──',
      `  Ignoring battery optimization: ${diag.battery?.ignoringBatteryOptimization}`,
      `  Device idle (Doze): ${diag.battery?.isDeviceIdleMode}`,
      `  Power save mode: ${diag.battery?.isPowerSaveMode}`,
      '',
      '── Time ──',
      `  Current date: ${diag.time?.currentDate}`,
      `  Timezone: ${diag.time?.timezone}`,
      '',
      '── Debug Log (native) ──',
      diag.debugLog ?? '(empty)',
      '',
      '═══════════════════════════════════════════════════',
    ];

    console.log(`[StepService:Diagnostics]\n${lines.join('\n')}`);
    return diag;
  }
}

export interface StepDiagnostics {
  device?: {
    apiLevel: number;
    androidVersion: string;
    manufacturer: string;
    model: string;
    brand: string;
    device: string;
    hardware: string;
    board: string;
    soc: string;
  };
  permission?: {
    activityRecognitionRequired: boolean;
    activityRecognitionGranted: boolean;
    permissionStatus: string;
    retryCount: number;
    retryExhausted: boolean;
  };
  sensor?: {
    sensorManagerAvailable: boolean;
    stepCounterAvailable: boolean;
    stepDetectorAvailable: boolean;
    sensorName?: string;
    sensorVendor?: string;
    sensorVersion?: number;
    sensorMaxRange?: number;
    sensorResolution?: number;
    sensorMinDelay?: number;
    sensorMaxDelay?: number;
    isWakeUpSensor?: boolean;
    fifoMaxCount?: number;
    fifoReservedCount?: number;
  };
  service?: {
    liveStepCount: number;
    serviceRunning: boolean;
    displayStepFloor: number;
    source: string;
    lastSensorEventTime: number;
    sensorEventCount: number;
    secondsSinceLastSensorEvent: number;
    /** True while Health Connect is standing in for a silent hardware sensor. */
    hcPollingMode: boolean;
    /** True when the sensor has a hardware FIFO, so flush() is meaningful. */
    sensorSupportsFlush: boolean;
    /** True when this device only emits step events on listener re-registration. */
    pollByReregisterMode: boolean;
    /** Sensor listener re-registrations this session. High values mean churn. */
    reregisterCount: number;
  };
  stepState?: {
    baseline: number;
    dailySteps: number;
    rebootOffset: number;
    storedDate: string;
    lastCumulative: number;
    lastSyncTime: number;
    lastSyncedSteps: number;
    inflationFixV6: boolean;
    ownHcRecordsPurged: boolean;
  };
  battery?: {
    ignoringBatteryOptimization: boolean;
    isDeviceIdleMode: boolean;
    isPowerSaveMode: boolean;
  };
  time?: {
    currentTimeMs: number;
    currentDate: string;
    timezone: string;
  };
  debugLog?: string;
}

export const stepService = new StepService();
