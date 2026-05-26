# Implementation Plan: Built-in Step Counter

## Overview

Implement a native hardware step counter for Athlofit on pre-Android 14 (API < 34) devices. The system reads from the device's `TYPE_STEP_COUNTER` hardware sensor via an Android foreground service, bridges data to React Native through a native module, and integrates with the existing health sync pipeline. On API 34+ devices, the existing Health Connect integration remains unchanged.

## Tasks

- [x] 1. Create core infrastructure and utility classes
  - [x] 1.1 Create StepSourceResolver utility
    - Create `android/app/src/main/java/com/athlofit/StepSourceResolver.kt`
    - Implement `resolve(context: Context): Source` that returns `HEALTH_CONNECT` when API ≥ 34, `NATIVE_SENSOR` when API < 34 and TYPE_STEP_COUNTER sensor is present, or `UNAVAILABLE` otherwise
    - Handle null SensorManager case (treat as UNAVAILABLE)
    - Expose the `Source` enum with values: HEALTH_CONNECT, NATIVE_SENSOR, UNAVAILABLE
    - _Requirements: 1.1, 1.4, 1.5, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 1.2 Create StepPermissionManager
    - Create `android/app/src/main/java/com/athlofit/StepPermissionManager.kt`
    - Implement `needsPermission(): Boolean` returning true when `Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q`
    - Implement `isGranted(context: Context): Boolean` checking ACTIVITY_RECOGNITION permission
    - Implement `getStatus(context: Context): String` returning "granted", "denied", or "not_required"
    - Implement `requestPermission(activity: Activity, callback: (Boolean) -> Unit)` with retry logic (max 2 retries per session)
    - Track retry count per session, reset on app restart
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 1.3 Write property tests for StepSourceResolver
    - **Property 1: Step Source Selection**
    - **Validates: Requirements 1.1, 1.3, 1.4, 7.1, 7.2, 7.5**
    - Generate random combinations of (apiLevel: 19-35, sensorPresent: boolean, hcAvailable: boolean)
    - Assert correct source is returned for each combination per the truth table in the design

  - [ ]* 1.4 Write property tests for StepPermissionManager retry bounds
    - **Property 3: Permission Retry Bounds**
    - **Validates: Requirements 2.3**
    - Generate random sequences of denial events (length 1-10)
    - Assert retry prompts never exceed 2 per session

- [x] 2. Implement StepCounterService (foreground service)
  - [x] 2.1 Create StepCounterService with sensor registration and step calculation
    - Create `android/app/src/main/java/com/athlofit/StepCounterService.kt`
    - Extend `Service()` and implement `SensorEventListener`
    - Register TYPE_STEP_COUNTER sensor with SENSOR_DELAY_NORMAL and maxReportLatency of 10 seconds
    - Implement `onSensorChanged()`: calculate dailySteps = (cumulative - baseline) + rebootOffset
    - Handle reboot detection: if cumulative <= baseline, add dailySteps to rebootOffset, reset baseline
    - Use START_STICKY for automatic restart by system
    - Emit failure to NativeStepModule if sensor listener registration fails, then stop service
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 9.1, 9.2, 9.3_

  - [x] 2.2 Implement StepDataStore persistence logic in StepCounterService
    - Use SharedPreferences file "StepCounterPrefs" with keys: baseline, dailySteps, rebootOffset, storedDate, lastSyncTime, pendingSyncPayload
    - Persist step count at intervals no greater than 90 seconds (maybePersist)
    - Persist on service stop/destroy (onDestroy)
    - Load baseline and storedDate on service start
    - _Requirements: 3.7, 3.8_

  - [x] 2.3 Implement midnight reset logic in StepCounterService
    - Implement `performMidnightReset()`: persist previous day's total (dailySteps + rebootOffset) with previous date, reset dailySteps to 0, rebootOffset to 0, set baseline to current sensor value, update storedDate
    - On service start: detect date change (storedDate != today) and trigger reset
    - Handle multi-day gaps: persist stored date's steps, record zero for intermediate days
    - Schedule inexact AlarmManager alarm targeting next midnight as fallback
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 2.4 Implement notification display in StepCounterService
    - Reuse existing "step_counter_live" notification channel with IMPORTANCE_LOW
    - Display persistent foreground notification with: step count (thousands separators) in title, goal and percentage in body, progress bar
    - On start, show cached step count from StepDataStore (never show zero while awaiting first sensor event)
    - Update notification within 60 seconds of step count change
    - Set visibility to PUBLIC (visible on lock screen)
    - On tap, open Athlofit app to steps screen
    - Suppress sound and vibration for all updates
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 2.5 Implement background sync in StepCounterService
    - Derive calories, distance, activeMinutes from steps using design formulas
    - Use default weight of 70.0 kg if weightKg unavailable from SharedPreferences
    - Build JSON payload matching POST /health/sync format
    - Call `HealthSyncHelper.postSync()` every 15 minutes (rate-limited)
    - On sync failure: retain pendingSyncPayload in StepDataStore, retry next cycle
    - Read Bearer token from "StepsWidgetPrefs" SharedPreferences (key: "accessToken")
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 9.4_

  - [x] 2.6 Implement widget update in StepCounterService
    - Write current step count to SharedPreferences "StepsWidgetPrefs" (key: "steps") and goal (key: "goal")
    - Send ACTION_APPWIDGET_UPDATE broadcast to StepsWidgetProvider within 5 seconds of step update
    - Swallow broadcast failures silently (non-fatal)
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ]* 2.7 Write property tests for step calculation correctness
    - **Property 4: Step Calculation Correctness**
    - **Validates: Requirements 3.4, 3.5, 3.6**
    - Generate random sequences of sensor events including reboot scenarios (cumulative resets)
    - Assert dailySteps always equals sum of actual steps taken since midnight

  - [ ]* 2.8 Write property tests for midnight reset state transition
    - **Property 5: Midnight Reset State Transition**
    - **Validates: Requirements 4.1, 4.2**
    - Generate random pre-states (dailySteps: 0-50000, offset: 0-10000, baseline: 0-MAX_LONG)
    - Assert post-state: dailySteps=0, rebootOffset=0, baseline=currentSensorValue, storedDate=today

  - [ ]* 2.9 Write property tests for multi-day gap filling
    - **Property 6: Multi-Day Gap Filling**
    - **Validates: Requirements 4.3**
    - Generate random gaps (2-30 days) with random stored step counts
    - Assert exactly one record for stored date and N-1 zero records for intermediate days

  - [ ]* 2.10 Write property tests for derived metrics calculation
    - **Property 8: Derived Metrics Calculation**
    - **Validates: Requirements 6.1, 6.4, 6.5, 6.6, 6.7**
    - Generate random (steps: 0-100000, weight: 30.0-200.0)
    - Assert calories = floor(steps × weightKg × 0.57 / 1000), distance = round(steps × 0.76 / 1000, 2), activeMinutes = floor(steps / 100)

  - [ ]* 2.11 Write property tests for sync data retention on failure
    - **Property 9: Sync Data Retention on Failure**
    - **Validates: Requirements 6.3**
    - Generate random failure/success sequences
    - Assert pending payload is never discarded on failure

  - [ ]* 2.12 Write property tests for network sync rate limiting
    - **Property 10: Network Rate Limiting**
    - **Validates: Requirements 9.4**
    - Generate random trigger event sequences with timestamps
    - Assert no two POST calls occur within 15 minutes of each other

- [x] 3. Checkpoint - Ensure StepCounterService compiles and unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create MidnightResetReceiver and modify BootReceiver
  - [x] 4.1 Create MidnightResetReceiver
    - Create `android/app/src/main/java/com/athlofit/MidnightResetReceiver.kt`
    - Extend BroadcastReceiver
    - On receive: if StepCounterService is not running, start it (triggers date-change detection and reset)
    - If service is running, call performMidnightReset directly via intent extra
    - _Requirements: 4.4, 4.5_

  - [x] 4.2 Modify BootReceiver to start StepCounterService
    - In `BootReceiver.kt`, add logic to check `StepSourceResolver.resolve(context)`
    - If source is `NATIVE_SENSOR`, start `StepCounterService` on boot
    - Keep existing WidgetScheduler, EodSyncScheduler, and StepNotificationService calls
    - _Requirements: 3.9_

- [x] 5. Create NativeStepModule and NativeStepPackage (React Native bridge)
  - [x] 5.1 Create NativeStepModule
    - Create `android/app/src/main/java/com/athlofit/NativeStepModule.kt`
    - Extend `ReactContextBaseJavaModule`, register as "NativeStep"
    - Implement `start()`: check source, request permission if needed, start StepCounterService, resolve Promise with true
    - Implement `stop()`: stop StepCounterService, resolve Promise with true
    - Implement `getCurrentSteps()`: read from StepDataStore, return non-negative integer (0 if no data)
    - Implement `isSensorAvailable()`: query SensorManager for TYPE_STEP_COUNTER
    - Implement `getPermissionStatus()`: delegate to StepPermissionManager.getStatus()
    - Implement `getActiveSource()`: delegate to StepSourceResolver.resolve(), return string
    - Emit "onStepUpdate" events (throttled to max once per 5 seconds)
    - Emit "onServiceStopped" when service stops
    - Emit "onSensorUnavailable" when sensor not found
    - On API ≥ 34: skip sensor check, do not start service, rely on Health Connect
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 7.5_

  - [x] 5.2 Create NativeStepPackage
    - Create `android/app/src/main/java/com/athlofit/NativeStepPackage.kt`
    - Implement standard ReactPackage that registers NativeStepModule
    - _Requirements: 5.1_

  - [x] 5.3 Register NativeStepPackage in MainApplication
    - Add `add(NativeStepPackage())` to the packages list in `MainApplication.kt`
    - _Requirements: 5.1_

  - [ ]* 5.4 Write property tests for event emission throttling
    - **Property 7: Event Emission Throttling**
    - **Validates: Requirements 5.5**
    - Generate random sequences of step count changes with timestamps
    - Assert no two consecutive emitted events are less than 5 seconds apart

  - [ ]* 5.5 Write property tests for permission gating
    - **Property 2: Permission Gating**
    - **Validates: Requirements 2.1, 2.6, 2.7**
    - Generate random (apiLevel: 19-35, permissionState: granted/denied/not_required)
    - Assert sensor listener registration only occurs when API < 29 OR permission is granted

- [x] 6. Update AndroidManifest.xml
  - [x] 6.1 Add permissions and service declarations to AndroidManifest.xml
    - Add `<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />`
    - Add `<uses-permission android:name="android.permission.FOREGROUND_SERVICE_HEALTH" />`
    - Declare `StepCounterService` with `android:foregroundServiceType="health"`
    - Declare `MidnightResetReceiver` (not exported)
    - _Requirements: 2.1, 3.3_

- [x] 7. Checkpoint - Ensure native code compiles and all declarations are correct
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Create JavaScript service layer
  - [x] 8.1 Create stepService.ts
    - Create `src/services/stepService.ts`
    - Import NativeModules and NativeEventEmitter from react-native
    - Implement `initialize(): Promise<StepSource>` — calls getActiveSource()
    - Implement `start(): Promise<boolean>` — calls NativeStep.start()
    - Implement `stop(): Promise<boolean>` — calls NativeStep.stop()
    - Implement `getCurrentSteps(): Promise<number>` — calls NativeStep.getCurrentSteps()
    - Implement `onStepUpdate(callback): () => void` — subscribes to "onStepUpdate" event, returns unsubscribe function
    - Implement `getSource(): StepSource` — returns cached source value
    - Define `StepSource` type: 'health_connect' | 'native_sensor' | 'unavailable'
    - _Requirements: 5.1, 5.3, 5.4, 5.5, 7.5, 10.4_

  - [x] 8.2 Integrate stepService with existing widgetService
    - Modify `src/services/widgetService.ts` to conditionally use stepService for native source
    - When source is 'native_sensor', step notification is managed by StepCounterService (skip startStepNotification/stopStepNotification calls from widgetService for native path)
    - _Requirements: 10.4, 10.5_

- [x] 9. Modify StepNotificationService for native source compatibility
  - [x] 9.1 Update StepNotificationService to read from StepDataStore when native source is active
    - In `StepNotificationService.kt`, check `StepSourceResolver.resolve(context)`
    - If source is `NATIVE_SENSOR`: read steps from "StepCounterPrefs" SharedPreferences instead of querying Health Connect
    - If source is `HEALTH_CONNECT`: keep existing Health Connect aggregate logic unchanged
    - This ensures the notification service works correctly regardless of step source
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 10. Final checkpoint - Ensure all components compile and integrate correctly
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses Kotlin for Android native code and TypeScript for the JavaScript layer
- Existing `HealthSyncHelper.postSync()` is reused directly — no backend changes needed
- The `StepNotificationService` is modified (not replaced) to support both step sources
- `StepsWidgetProvider` requires no code changes — it already reads from "StepsWidgetPrefs" SharedPreferences

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 3, "tasks": ["2.5", "2.6", "2.7", "2.8", "2.9"] },
    { "id": 4, "tasks": ["2.10", "2.11", "2.12", "4.1", "4.2"] },
    { "id": 5, "tasks": ["5.1", "5.2", "6.1"] },
    { "id": 6, "tasks": ["5.3", "5.4", "5.5"] },
    { "id": 7, "tasks": ["8.1"] },
    { "id": 8, "tasks": ["8.2", "9.1"] }
  ]
}
```
