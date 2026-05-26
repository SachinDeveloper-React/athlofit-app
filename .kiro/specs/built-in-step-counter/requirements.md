# Requirements Document

## Introduction

Athlofit currently relies on Health Connect APIs for step counting, which requires either Android 14+ (where Health Connect is built-in) or a separate Health Connect APK on older devices. Many users on pre-Android 14 devices (API 19–33) must install a third-party app just to get step data into Athlofit.

This feature introduces a built-in step counter that reads directly from the device's hardware step sensor (TYPE_STEP_COUNTER / TYPE_STEP_DETECTOR), available since Android 4.4 (API 19). On pre-Android 14 devices, Athlofit will count steps natively without any external dependency. On Android 14+ devices, the existing Health Connect integration remains the primary source.

## Glossary

- **Step_Counter_Service**: The Android foreground service that registers with the hardware step sensor and accumulates step counts throughout the day.
- **Step_Sensor**: The device's hardware step counter sensor (Sensor.TYPE_STEP_COUNTER) that provides a cumulative step count since last device reboot.
- **Step_Detector**: The device's hardware step detector sensor (Sensor.TYPE_STEP_DETECTOR) that fires an event for each detected step.
- **Native_Step_Module**: The React Native native module that bridges the Android step counting service to the JavaScript layer.
- **Step_Data_Store**: Local persistent storage (SharedPreferences) that holds the daily step count, sensor baseline, and midnight reset reference.
- **Health_Sync_Endpoint**: The existing POST /health/sync backend endpoint that receives daily health snapshots from the app.
- **Permission_Manager**: The component responsible for requesting and managing the ACTIVITY_RECOGNITION runtime permission required for step sensor access on Android 10+.

## Requirements

### Requirement 1: Hardware Sensor Availability Detection

**User Story:** As a user on a pre-Android 14 device, I want Athlofit to detect whether my device has a hardware step sensor, so that the app can determine the best step counting strategy.

#### Acceptance Criteria

1. WHEN the app launches on a device running Android API level below 34, THE Native_Step_Module SHALL query the SensorManager for Sensor.TYPE_STEP_COUNTER hardware and expose the result (available or unavailable) to the JavaScript layer within 5 seconds of launch.
2. IF the device does not have a TYPE_STEP_COUNTER sensor, THEN THE Native_Step_Module SHALL emit a sensor-unavailability event to the JavaScript layer and SHALL NOT attempt to start the Step_Counter_Service.
3. WHEN the app launches on a device that has a TYPE_STEP_COUNTER sensor and the Android API level is below 34, THE Native_Step_Module SHALL start the built-in step counting path and SHALL NOT start the Health Connect integration for step data.
4. WHEN the app launches on a device running Android API level 34 or above, THE Native_Step_Module SHALL skip the sensor availability check, SHALL NOT start the Step_Counter_Service, and SHALL rely on the existing Health Connect integration for step data.
5. IF the SensorManager is unavailable (returns null) on a device with API level below 34, THEN THE Native_Step_Module SHALL treat the device as having no step sensor and SHALL emit a sensor-unavailability event to the JavaScript layer.

### Requirement 2: Activity Recognition Permission

**User Story:** As a user on Android 10+, I want Athlofit to request the necessary permission for step counting, so that the app can access the step sensor without requiring a separate app.

#### Acceptance Criteria

1. WHEN the app activates the built-in step counting path on Android API level 29 or above, THE Permission_Manager SHALL request the ACTIVITY_RECOGNITION runtime permission.
2. WHEN the user grants the ACTIVITY_RECOGNITION permission, THE Permission_Manager SHALL notify the Native_Step_Module to start the Step_Counter_Service.
3. IF the user denies the ACTIVITY_RECOGNITION permission and has not selected "Don't ask again", THEN THE Permission_Manager SHALL display an explanation of why step counting requires this permission and offer a retry option, up to a maximum of 2 retry attempts per app session.
4. IF the user has permanently denied the ACTIVITY_RECOGNITION permission (selected "Don't ask again") or has exhausted the 2 retry attempts, THEN THE Permission_Manager SHALL display a message directing the user to enable the permission in device Settings and SHALL report step counting as unavailable to the JavaScript layer.
5. IF the ACTIVITY_RECOGNITION permission request fails to trigger on Android 10+, THEN THE Permission_Manager SHALL display an error indication to the user, report step counting as unavailable to the JavaScript layer, and prevent the step counting feature from activating.
6. WHILE the ACTIVITY_RECOGNITION permission is not granted on Android 10+, THE Native_Step_Module SHALL NOT attempt to register with the Step_Sensor.
7. WHEN the app runs on Android API level below 29, THE Permission_Manager SHALL skip the ACTIVITY_RECOGNITION permission request and proceed directly to start the Step_Counter_Service.

### Requirement 3: Foreground Step Counting Service

**User Story:** As a user, I want Athlofit to count my steps continuously in the background, so that I get accurate step counts throughout the day without keeping the app open.

#### Acceptance Criteria

1. WHEN the Step_Counter_Service starts, THE Step_Counter_Service SHALL register a SensorEventListener with the TYPE_STEP_COUNTER sensor using SENSOR_DELAY_NORMAL batch mode.
2. IF the Step_Counter_Service fails to register the SensorEventListener with the TYPE_STEP_COUNTER sensor, THEN THE Step_Counter_Service SHALL notify the Native_Step_Module of the failure and stop the service.
3. WHILE the Step_Counter_Service is running, THE Step_Counter_Service SHALL maintain foreground service status with a persistent notification as defined in Requirement 8.
4. WHEN the Step_Sensor delivers a new step count event, THE Step_Counter_Service SHALL calculate the daily steps by subtracting the stored baseline from the cumulative sensor value.
5. WHEN the Step_Counter_Service starts and the stored baseline date in Step_Data_Store differs from the current calendar date (local time), THE Step_Counter_Service SHALL record the current cumulative sensor value as the baseline for the new day.
6. IF the cumulative sensor value is less than or equal to the stored baseline (indicating a device reboot or data reset), THEN THE Step_Counter_Service SHALL reset the baseline to the current sensor value and add the previously accumulated steps for the day to an offset stored in Step_Data_Store.
7. THE Step_Counter_Service SHALL persist the daily step count to Step_Data_Store at intervals no greater than 90 seconds.
8. WHEN the Step_Counter_Service is stopped or destroyed, THE Step_Counter_Service SHALL persist the current daily step count to Step_Data_Store before releasing resources.
9. WHEN the device completes a boot, THE Step_Counter_Service SHALL restart automatically via a BOOT_COMPLETED broadcast receiver.

### Requirement 4: Midnight Day Reset

**User Story:** As a user, I want my step count to reset at midnight each day, so that I see an accurate daily count each morning.

#### Acceptance Criteria

1. WHEN the local time crosses midnight (00:00:00), THE Step_Counter_Service SHALL persist the current day's final step count to Step_Data_Store with the corresponding date, reset the daily step count to zero, reset any reboot offset to zero, and record the current cumulative sensor value as the new baseline.
2. WHEN the Step_Counter_Service starts and detects that the stored date differs from the current date, THE Step_Counter_Service SHALL persist the previous day's accumulated step count (daily steps plus any reboot offset) to Step_Data_Store with the previous date, reset the daily step count to zero, reset any reboot offset to zero, and record the current cumulative sensor value as the new baseline for the current date.
3. IF more than one calendar day has elapsed since the stored date when the Step_Counter_Service starts, THEN THE Step_Counter_Service SHALL persist the last recorded step count for the stored date and record zero steps for each intermediate day with no sensor data, then reset for the current day.
4. WHEN the Step_Counter_Service starts or completes a midnight reset, THE Step_Counter_Service SHALL schedule an inexact repeating AlarmManager alarm targeting the next occurrence of midnight (00:00:00) local time as a fallback reset trigger.
5. WHEN the AlarmManager midnight alarm fires and the Step_Counter_Service is not actively running, THE Step_Counter_Service SHALL start, detect the date change per criterion 2, and perform the reset.

### Requirement 5: React Native Bridge

**User Story:** As a developer, I want a React Native native module that exposes step counting functionality to the JavaScript layer, so that the app UI can display real-time step data.

#### Acceptance Criteria

1. THE Native_Step_Module SHALL expose a method to start the Step_Counter_Service from the JavaScript layer that resolves a Promise with a boolean value of true upon successful start.
2. IF the start method is called and the Step_Counter_Service fails to start (due to missing permission, unavailable sensor, or system error), THEN THE Native_Step_Module SHALL reject the Promise with an error indicating the failure reason.
3. THE Native_Step_Module SHALL expose a method to stop the Step_Counter_Service from the JavaScript layer that resolves a Promise with a boolean value of true upon successful stop.
4. THE Native_Step_Module SHALL expose a method to query the current daily step count from Step_Data_Store that returns a non-negative integer, returning 0 if no step data has been recorded for the current day.
5. WHEN the step count changes, THE Native_Step_Module SHALL emit an event to the JavaScript layer containing the updated daily step count as a non-negative integer, with a maximum emission frequency of once per 5 seconds.
6. IF the Step_Counter_Service stops or is terminated by the system, THEN THE Native_Step_Module SHALL emit a service-stopped event to the JavaScript layer.
7. THE Native_Step_Module SHALL expose a method to check whether the hardware step sensor is available on the device that returns a boolean value of true if TYPE_STEP_COUNTER is present, or false otherwise.
8. THE Native_Step_Module SHALL expose a method to check the current ACTIVITY_RECOGNITION permission status that returns one of the following string values: "granted", "denied", or "not_required" (for devices below Android API level 29).

### Requirement 6: Integration with Existing Health Sync

**User Story:** As a user, I want my natively counted steps to sync to the Athlofit backend just like Health Connect steps, so that my progress, streaks, and coins are tracked correctly regardless of the step source.

#### Acceptance Criteria

1. WHEN the built-in step counter is active, THE Native_Step_Module SHALL provide step data in the same payload structure expected by the POST /health/sync endpoint: date (YYYY-MM-DD string), steps (integer), calories (integer), distance (float rounded to 2 decimal places), activeMinutes (integer), and goalMet (boolean, true if steps >= user's dailyStepGoal).
2. WHEN a background sync is triggered (periodic every 15 minutes or end-of-day at 23:59), THE Step_Counter_Service SHALL post the daily step snapshot to the Health_Sync_Endpoint using the same Bearer token authentication and JSON payload structure as the existing HealthSyncHelper.
3. IF the background sync POST request fails (non-2xx response or network timeout after 15 seconds), THEN THE Step_Counter_Service SHALL retain the unsent snapshot and retry on the next scheduled sync cycle without discarding data.
4. THE Step_Counter_Service SHALL derive calories from steps using the formula: calories = steps × (weightKg × 0.57) / 1000, truncated to an integer.
5. IF the user's weightKg value is unavailable, THEN THE Step_Counter_Service SHALL use a default weight of 70.0 kg for calorie derivation.
6. THE Step_Counter_Service SHALL derive distance from steps using the formula: distanceKm = steps × 0.76 / 1000, rounded to 2 decimal places.
7. THE Step_Counter_Service SHALL derive active minutes from steps using the formula: activeMinutes = steps / 100, truncated to an integer (floor division).

### Requirement 7: Step Source Selection Logic

**User Story:** As a user, I want the app to automatically choose the best step data source for my device, so that I get accurate step counts without manual configuration.

#### Acceptance Criteria

1. WHEN the device runs Android API level 34 or above, THE Native_Step_Module SHALL use Health Connect as the step data source.
2. WHEN the device runs Android API level below 34 and has a TYPE_STEP_COUNTER sensor, THE Native_Step_Module SHALL use the built-in Step_Counter_Service as the step data source.
3. IF the device runs Android API level below 34 and does not have a TYPE_STEP_COUNTER sensor, THEN THE Native_Step_Module SHALL inform the user that step counting is unavailable on the device.
4. IF the device runs Android API level 34 or above and Health Connect is disabled or inaccessible, THEN THE Native_Step_Module SHALL report step counting as unavailable.
5. THE Native_Step_Module SHALL expose the active step source identifier ("health_connect" or "native_sensor" or "unavailable") to the JavaScript layer.

### Requirement 8: Notification Display

**User Story:** As a user, I want to see my live step count in the notification bar, so that I can check my progress without opening the app.

#### Acceptance Criteria

1. WHILE the Step_Counter_Service is running, THE Step_Counter_Service SHALL display a single persistent foreground notification containing: the current step count formatted with thousands separators in the title, the daily goal formatted with thousands separators and a percentage complete (0–100%) in the body text, and a progress bar representing the percentage of the daily goal achieved.
2. WHEN the Step_Counter_Service starts and no sensor data has been received yet, THE Step_Counter_Service SHALL display the most recent step count cached in Step_Data_Store so that the notification never shows zero while awaiting the first sensor event.
3. WHEN the step count changes, THE Step_Counter_Service SHALL update the notification content within 60 seconds of the change.
4. THE Step_Counter_Service SHALL reuse the existing "step_counter_live" notification channel with importance level LOW, and SHALL suppress sound and vibration for all notification updates.
5. THE Step_Counter_Service SHALL set the notification visibility to public so that the step count is visible on the lock screen without device unlock.
6. WHEN the user taps the step notification, THE Step_Counter_Service SHALL open the Athlofit app to the steps screen.

### Requirement 9: Battery Optimization

**User Story:** As a user, I want step counting to be power-efficient, so that it does not significantly drain my battery.

#### Acceptance Criteria

1. THE Step_Counter_Service SHALL use the hardware TYPE_STEP_COUNTER sensor (which is a low-power sensor that runs on a dedicated co-processor) rather than the accelerometer.
2. IF the hardware TYPE_STEP_COUNTER sensor is not available on the device, THEN THE Step_Counter_Service SHALL report an error indicating the sensor is unavailable and SHALL not fall back to the accelerometer.
3. THE Step_Counter_Service SHALL register the sensor listener with a maximum report latency of exactly 10 seconds and SHALL reject any configuration that specifies a latency value exceeding 10 seconds by returning an error indication to the caller and retaining the previous valid configuration.
4. THE Step_Counter_Service SHALL avoid performing network operations more frequently than once every 15 minutes for background sync.
5. WHEN the device enters Doze mode, THE Step_Counter_Service SHALL continue to accumulate steps via the hardware sensor without waking the main processor.
6. WHEN the device exits Doze mode, THE Step_Counter_Service SHALL deliver all steps accumulated during the Doze period to the step count total within 10 seconds of Doze exit.

### Requirement 10: Widget and UI Compatibility

**User Story:** As a user, I want the home screen widget and app UI to show my step count from the native sensor, so that all displays are consistent.

#### Acceptance Criteria

1. WHEN the built-in step counter updates the step count, THE Step_Counter_Service SHALL write the current step count as an integer to SharedPreferences (file: "StepsWidgetPrefs", key: "steps") and the daily goal as an integer (key: "goal"), matching the format used by the existing StepsWidgetProvider.
2. WHEN the Step_Counter_Service writes an updated step count to SharedPreferences, THE Step_Counter_Service SHALL send an ACTION_APPWIDGET_UPDATE broadcast targeting all active StepsWidgetProvider widget instances within 5 seconds so the home screen widget displays the latest count.
3. IF the widget refresh broadcast fails or no widget instances are registered, THEN THE Step_Counter_Service SHALL continue operating without error and SHALL NOT retry the broadcast.
4. THE Native_Step_Module SHALL provide step data to the React Native UI layer conforming to the existing HealthData interface (returning a numeric "steps" field as a non-negative integer), requiring no changes to the JavaScript step display components.
5. WHEN both the built-in step counter and the home screen widget are active simultaneously, THE step count displayed by the widget SHALL equal the step count displayed in the app UI, with no more than one refresh-cycle delay (60 seconds maximum) between them.
