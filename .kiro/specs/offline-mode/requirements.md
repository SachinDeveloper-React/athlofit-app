# Requirements Document

## Introduction

Offline Mode for Athlofit enables users to continue tracking health metrics (steps, hydration, heart rate, blood pressure) without an active internet connection. Health-related screens operate fully from cached/local data, while non-health screens display a connectivity banner. When the device regains connectivity, all locally queued actions sync automatically to the backend via the existing `POST /health/sync` endpoint.

## Glossary

- **Connectivity_Monitor**: The service responsible for detecting changes in network connectivity state (online/offline) using the device's network APIs.
- **Offline_Queue**: A persistent MMKV-backed queue that stores mutations (hydration entries, health syncs) created while the device is offline, for later replay.
- **Sync_Engine**: The component responsible for draining the Offline_Queue by replaying queued mutations to the backend when connectivity is restored.
- **Offline_Banner**: A non-intrusive UI banner displayed on screens that require server connectivity, informing the user that the device is offline.
- **Health_Screens**: The set of screens that operate fully offline — TrackerScreen, HydrationScreen, StepDetailScreen, HeartRateScreen, and BloodPressureScreen.
- **Online_Screens**: Screens that require fresh server data to function — Shop screens, LeaderboardScreen, ChallengesScreen, and similar.
- **Cache_Layer**: The combination of React Query cache and MMKV-persisted Zustand stores that provide locally available data for offline rendering.

## Requirements

### Requirement 1: Network Connectivity Detection

**User Story:** As a user, I want the app to detect when my device loses or regains internet connectivity, so that the app can adapt its behavior accordingly.

#### Acceptance Criteria

1. WHEN the device transitions from online to offline, THE Connectivity_Monitor SHALL update the system offline state within 3 seconds of the connectivity change.
2. WHEN the device transitions from offline to online, THE Connectivity_Monitor SHALL update the system online state within 5 seconds of the connectivity change.
3. THE Connectivity_Monitor SHALL expose the current connectivity state (online or offline) in the system store so that all components can read it synchronously without asynchronous fetches.
4. WHEN the app launches without network connectivity, THE Connectivity_Monitor SHALL initialize the system state as offline before the root navigation tree renders.
5. IF the network connectivity state is indeterminate during app launch (neither confirmed online nor confirmed offline), THEN THE Connectivity_Monitor SHALL treat the state as offline until a definitive connectivity signal is received.
6. IF the device connectivity toggles between online and offline more than once within a 3-second window, THEN THE Connectivity_Monitor SHALL apply only the final stable state after the 3-second stabilization period elapses, preventing rapid state flapping.
7. WHEN the Connectivity_Monitor updates the system state from offline to online, THE Connectivity_Monitor SHALL emit the state change only once per transition, regardless of how many underlying network events are received.

### Requirement 2: Offline Health Screen Operation

**User Story:** As a user, I want to view my health data and perform tracking actions (add water, view steps, view heart rate, view blood pressure) even when I have no internet connection, so that my fitness tracking is uninterrupted.

#### Acceptance Criteria

1. WHILE the device is offline, THE Health_Screens SHALL render using locally cached data from MMKV-persisted stores and React Query cache.
2. WHILE the device is offline, THE HydrationScreen SHALL allow the user to add water intake entries that are stored locally in the hydration store.
3. WHILE the device is offline, THE TrackerScreen SHALL display the most recently cached health metrics (steps, calories, distance, active minutes) without showing error states.
4. WHILE the device is offline, THE StepDetailScreen SHALL display step data sourced from Health Connect (device sensor) without requiring backend connectivity.
5. WHILE the device is offline, THE HeartRateScreen SHALL display heart rate data sourced from Health Connect without requiring backend connectivity.
6. WHILE the device is offline, THE BloodPressureScreen SHALL display blood pressure readings from local BLE storage without requiring backend connectivity.
7. WHILE the device is offline, THE Health_Screens SHALL suppress network error toasts and loading indicators that would normally appear during failed API calls.

### Requirement 3: Offline Action Queueing

**User Story:** As a user, I want my offline actions (adding water, health syncs) to be saved locally and sent to the server later, so that I never lose data due to connectivity issues.

#### Acceptance Criteria

1. WHEN the user performs a mutation action (hydration entry or health sync) while offline, THE Offline_Queue SHALL persist the action payload to MMKV storage within 1 second, recording the timestamp (ISO 8601), action type, endpoint, HTTP method, and request payload.
2. THE Offline_Queue SHALL preserve the chronological order of queued actions based on their recorded timestamp, such that entries retrieved from storage are always ordered oldest-first.
3. THE Offline_Queue SHALL retain queued actions across app restarts by using MMKV persistence, with no data loss on normal app termination or process kill.
4. IF the Offline_Queue storage exceeds 500 entries, THEN THE Offline_Queue SHALL discard the oldest entries until the queue size equals 500 before inserting the new entry.
5. THE Offline_Queue SHALL store each entry with the following fields: endpoint path, HTTP method, request payload, ISO 8601 timestamp, and action type, enabling replay of the request without requiring additional data or user context lookup.
6. IF a write to MMKV storage fails when persisting a queued action, THEN THE Offline_Queue SHALL retry the write once and, if the retry also fails, SHALL retain the action in memory for the current session and log the failure without displaying an error to the user.

### Requirement 4: Automatic Sync on Reconnection

**User Story:** As a user, I want all my offline actions to automatically sync with the server when my internet connection is restored, so that my data is consistent across devices.

#### Acceptance Criteria

1. WHEN the device transitions from offline to online, THE Sync_Engine SHALL begin draining the Offline_Queue within 5 seconds of connectivity restoration.
2. THE Sync_Engine SHALL replay queued actions in chronological order (oldest first), processing a maximum of 100 queued actions per sync session.
3. IF a queued action fails with a server error (5xx), THEN THE Sync_Engine SHALL retry the action up to 3 times with exponential backoff (2s, 4s, 8s).
4. IF a queued action fails with a client error (4xx), THEN THE Sync_Engine SHALL discard the action, persist a failure record containing the action type and timestamp to the dead-letter section, and log the failure.
5. IF a queued action fails after all retry attempts, THEN THE Sync_Engine SHALL move the action to a dead-letter section that retains a maximum of 50 entries (discarding the oldest entry when full) and continue processing remaining items.
6. WHEN the Sync_Engine completes draining the queue, THE Sync_Engine SHALL invalidate relevant React Query caches to refresh screen data with server-confirmed values.
7. WHILE the Sync_Engine is processing the queue, THE Sync_Engine SHALL prevent duplicate sync triggers from concurrent connectivity events.
8. IF the device transitions from online to offline while the Sync_Engine is processing the queue, THEN THE Sync_Engine SHALL halt processing, retain all unprocessed actions in the Offline_Queue in their original order, and resume from the next unprocessed action when connectivity is restored.

### Requirement 5: Offline Banner for Non-Health Screens

**User Story:** As a user, I want to see a clear indication when I'm offline on screens that need internet, so that I understand why content may be unavailable or stale.

#### Acceptance Criteria

1. WHILE the device is offline, THE Offline_Banner SHALL be visible on all Online_Screens (Shop, Leaderboard, Challenges).
2. THE Offline_Banner SHALL display the text "No internet connection" with a cloud-off or Wi-Fi-off icon that is at least 24×24 dp in size.
3. THE Offline_Banner SHALL appear at the top of the screen content area, below the navigation header.
4. WHEN the device transitions from offline to online, THE Offline_Banner SHALL be dismissed within 3 seconds of connectivity restoration.
5. THE Offline_Banner SHALL not obstruct interactive elements or prevent scrolling of underlying content.
6. WHILE the device is offline, THE Online_Screens SHALL display cached content below the Offline_Banner rather than showing an empty state, provided cached data exists for that screen.
7. IF the device is offline and no cached content exists for an Online_Screen, THEN THE Online_Screen SHALL display a centered empty-state message indicating that content is unavailable offline and will load when connectivity is restored.

### Requirement 6: Hydration Offline Sync

**User Story:** As a user, I want my hydration entries added while offline to sync to the backend when I'm back online, so that my hydration history is complete on the server.

#### Acceptance Criteria

1. WHEN the user adds a hydration entry while offline, THE HydrationScreen SHALL apply the entry optimistically to the local hydration store immediately.
2. WHEN the user adds a hydration entry while offline, THE Offline_Queue SHALL enqueue a hydration sync payload containing the entry amount, timestamp, and daily total.
3. WHEN connectivity is restored, THE Sync_Engine SHALL replay hydration sync payloads to the `POST /health/sync` endpoint with the hydration data included.
4. IF the hydration sync succeeds, THEN THE Sync_Engine SHALL remove the entry from the Offline_Queue.
5. THE HydrationScreen SHALL reflect the locally stored hydration total regardless of sync status, ensuring the user always sees an accurate local count.

### Requirement 7: Health Data Background Sync Resilience

**User Story:** As a user, I want the existing background health sync to handle offline periods gracefully, so that no health data is lost when the sync fires without connectivity.

#### Acceptance Criteria

1. IF the background sync fires while the device is offline, THEN THE backgroundSync service SHALL enqueue the sync payload into the Offline_Queue instead of discarding it.
2. WHEN connectivity is restored after a missed background sync, THE Sync_Engine SHALL include the queued background sync payloads in the drain sequence.
3. THE backgroundSync service SHALL not show error notifications to the user when a sync fails due to offline state.
4. IF the background sync fires while previous offline sync payloads are still queued, THEN THE backgroundSync service SHALL append the new payload without overwriting existing queue entries.
