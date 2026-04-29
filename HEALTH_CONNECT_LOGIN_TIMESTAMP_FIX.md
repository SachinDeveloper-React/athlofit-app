# Health Connect Login Timestamp Fix

## Problem
When a user creates a new account or logs into a different account, the app was syncing **ALL historical Health Connect data** (including steps from earlier in the day before they logged in) to the new account.

### Example Scenario
1. User A walks 3500 steps from 8 AM to 2 PM
2. User A logs out at 2 PM
3. User B logs in at 2 PM on the same device
4. **Bug**: User B's account immediately shows 3500 steps (User A's steps)
5. **Expected**: User B's account should show 0 steps, and only count steps from 2 PM onwards

## Root Cause

### Health Connect Data is Device-Level
Health Connect stores health data at the **device level**, not the app level. This means:
- All step data from the device's step sensor is stored in Health Connect
- When the app queries Health Connect, it gets ALL data for the requested time range
- The app was using `todayRange()` which fetches data from **00:00 (midnight) to now**
- This includes steps accumulated before the current user logged in

### Previous Partial Fix
There was already account switch detection in `TrackerScreen.tsx` (lines 177-186) that prevented syncing **old session data**, but it didn't prevent fetching **historical data from Health Connect** for the current day.

## Solution

### Architecture
Implemented a **login timestamp filter** system:

1. **Store login timestamp** when user logs in
2. **Filter Health Connect queries** to only fetch data from login timestamp onwards
3. **Persist timestamp** across app restarts
4. **Reset timestamp** on logout

### Implementation Details

#### 1. Added Login Timestamp to healthDataStore ✅
**File**: `src/features/health/store/healthDataStore.ts`

```typescript
interface HealthDataStore {
  data: HealthData;
  lastUpdated: Date | null;
  loginTimestamp: number | null; // NEW: Timestamp when user logged in
  setLoginTimestamp: (timestamp: number) => void;
  reset: () => void;
}
```

**Features**:
- Stores the exact millisecond timestamp when user logged in
- Persisted to MMKV storage (survives app restarts)
- Cleared on logout (via `reset()`)

#### 2. Set Login Timestamp on Login ✅
**File**: `src/features/auth/store/authStore.ts`

**On login/register** (`setAuth`):
```typescript
// Set login timestamp to filter historical Health Connect data
import('../../health/store/healthDataStore').then(({ useHealthDataStore }) => {
  useHealthDataStore.getState().setLoginTimestamp(Date.now());
});
```

**On session restore** (`setTokensFromStorage`):
```typescript
// Set login timestamp if not already set (first launch after login)
const currentTimestamp = useHealthDataStore.getState().loginTimestamp;
if (!currentTimestamp) {
  useHealthDataStore.getState().setLoginTimestamp(Date.now());
}
```

#### 3. Created sinceLoginRange Helper ✅
**File**: `src/features/health/service/healthConnect.service.ts`

```typescript
/**
 * Get time range from login timestamp to now (for filtering historical data)
 * If no login timestamp, falls back to today's range
 */
export const sinceLoginRange = (loginTimestamp: number | null) => {
  if (!loginTimestamp) {
    return todayRange();
  }
  
  // Use the later of: login timestamp OR start of today
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const effectiveStart = Math.max(loginTimestamp, startOfDay.getTime());
  
  return {
    operator: 'between' as const,
    startTime: new Date(effectiveStart).toISOString(),
    endTime: new Date().toISOString(),
  };
};
```

**Logic**:
- If user logged in today at 2 PM, fetch steps from 2 PM to now
- If user logged in yesterday, fetch steps from midnight (start of today) to now
- If no login timestamp (legacy users), fall back to `todayRange()` (midnight to now)

#### 4. Updated fetchAllHealthConnectData ✅
**File**: `src/features/health/service/healthConnect.service.ts`

```typescript
export const fetchAllHealthConnectData = async (
  weightKg = DEFAULT_WEIGHT_KG,
  loginTimestamp: number | null = null, // NEW parameter
): Promise<HealthData> => {
  // Use sinceLoginRange for steps to prevent syncing historical data
  const stepsTimeRange = sinceLoginRange(loginTimestamp);
  
  const [stepsRecords, ...] = await Promise.all([
    // IMPORTANT: Use sinceLoginRange to only get steps since user logged in
    readRecords('Steps', { timeRangeFilter: stepsTimeRange }),
    // ... other health data
  ]);
  
  console.log(`[HealthConnect] Fetched ${steps} steps since ${stepsTimeRange.startTime}`);
  // ...
}
```

#### 5. Updated useHealth Hook ✅
**File**: `src/features/health/hooks/useHealth.ts`

```typescript
const loadData = async (p: HealthPlatform, silent: boolean = false) => {
  if (!silent) setIsLoading(true);
  try {
    let result: HealthData;
    if (p === 'healthkit') {
      result = await fetchAllHealthKitData();
    } else {
      // Get login timestamp from healthDataStore to filter historical data
      const { useHealthDataStore } = await import('../store/healthDataStore');
      const loginTimestamp = useHealthDataStore.getState().loginTimestamp;
      result = await fetchAllHealthConnectData(weightKg, loginTimestamp);
    }
    setData(result);
    setLastUpdated(new Date());
  } catch (e: any) {
    if (!silent) setError(e?.message ?? 'Failed to load health data');
  } finally {
    if (!silent) setIsLoading(false);
  }
};
```

## Data Flow

### Before Fix ❌
```
User B logs in at 2 PM
    ↓
App queries Health Connect: "Give me steps from 00:00 to now"
    ↓
Health Connect returns: 3500 steps (User A's steps from 8 AM - 2 PM)
    ↓
App syncs 3500 steps to User B's account ❌
```

### After Fix ✅
```
User B logs in at 2 PM
    ↓
authStore.setAuth() → healthDataStore.setLoginTimestamp(2 PM)
    ↓
App queries Health Connect: "Give me steps from 2 PM to now"
    ↓
Health Connect returns: 0 steps (no steps since 2 PM)
    ↓
App syncs 0 steps to User B's account ✅
    ↓
User B walks 500 steps from 2 PM to 3 PM
    ↓
App queries Health Connect: "Give me steps from 2 PM to now"
    ↓
Health Connect returns: 500 steps
    ↓
App syncs 500 steps to User B's account ✅
```

## Edge Cases Handled

### 1. User Logs In Multiple Times Same Day
**Scenario**: User logs in at 9 AM, logs out, logs in again at 3 PM

**Behavior**: 
- First login: Timestamp set to 9 AM, fetches steps from 9 AM onwards
- Logout: Timestamp cleared
- Second login: Timestamp set to 3 PM, fetches steps from 3 PM onwards ✅

### 2. User Logs In, App Restarts
**Scenario**: User logs in at 2 PM, closes app, reopens at 4 PM

**Behavior**:
- Login: Timestamp set to 2 PM, persisted to storage
- App restart: Timestamp loaded from storage (still 2 PM)
- Fetch: Gets steps from 2 PM to 4 PM ✅

### 3. User Logged In Yesterday, Opens App Today
**Scenario**: User logged in yesterday at 5 PM, opens app today at 10 AM

**Behavior**:
- `sinceLoginRange()` uses `Math.max(loginTimestamp, startOfDay)`
- Fetches steps from **midnight today** (not yesterday 5 PM)
- This is correct because backend tracks daily steps separately ✅

### 4. Legacy Users (No Login Timestamp)
**Scenario**: Existing users who logged in before this fix

**Behavior**:
- `loginTimestamp` is `null`
- `sinceLoginRange(null)` falls back to `todayRange()`
- Fetches steps from midnight to now (same as before)
- On next login, timestamp will be set ✅

### 5. Account Switch Detection
**Scenario**: User A logged in, User B logs in on same device

**Behavior**:
- TrackerScreen detects user ID change (existing logic)
- Skips syncing old data
- Refreshes health data for new user
- New login timestamp set for User B
- Only User B's steps (from login onwards) are fetched ✅

## Testing Checklist

### Test 1: New Account After Existing Steps
1. Walk 2000 steps from 8 AM to 12 PM (logged in as User A)
2. Log out at 12 PM
3. Create new account (User B) at 12 PM
4. **Expected**: User B shows 0 steps
5. Walk 500 more steps from 12 PM to 1 PM
6. **Expected**: User B shows 500 steps (not 2500)

### Test 2: Account Switch
1. User A walks 3000 steps, logs out
2. User B logs in on same device
3. **Expected**: User B shows 0 steps
4. User B walks 1000 steps
5. **Expected**: User B shows 1000 steps (not 4000)

### Test 3: App Restart
1. User logs in at 2 PM
2. Walk 500 steps
3. Close app completely
4. Reopen app at 3 PM
5. Walk 300 more steps
6. **Expected**: Shows 800 steps total (500 + 300)

### Test 4: Midnight Rollover
1. User logged in yesterday at 5 PM
2. Open app today at 10 AM
3. Walk 1000 steps today
4. **Expected**: Shows 1000 steps (not including yesterday's steps)

### Test 5: Multiple Logins Same Day
1. Login at 9 AM, walk 1000 steps, logout
2. Login again at 2 PM, walk 500 steps
3. **Expected**: Shows 500 steps (not 1500)

## Files Modified

1. **`src/features/health/store/healthDataStore.ts`**
   - Added `loginTimestamp` field
   - Added `setLoginTimestamp()` method
   - Added persistence with MMKV
   - Updated `reset()` to clear timestamp

2. **`src/features/auth/store/authStore.ts`**
   - Set login timestamp in `setAuth()` (on login/register)
   - Set login timestamp in `setTokensFromStorage()` (on session restore)

3. **`src/features/health/service/healthConnect.service.ts`**
   - Added `sinceLoginRange()` helper function
   - Updated `fetchAllHealthConnectData()` to accept `loginTimestamp` parameter
   - Updated steps query to use `sinceLoginRange()` instead of `todayRange()`
   - Added logging for debugging

4. **`src/features/health/hooks/useHealth.ts`**
   - Updated `loadData()` to get login timestamp from store
   - Pass login timestamp to `fetchAllHealthConnectData()`

## Benefits

✅ **Data Isolation**: Each user only sees their own steps
✅ **Accurate Tracking**: Steps counted from login time, not midnight
✅ **Persistent**: Survives app restarts
✅ **Backward Compatible**: Legacy users without timestamp still work
✅ **Account Switch Safe**: Prevents data leakage between accounts
✅ **Performant**: No additional API calls, just timestamp filtering

## Impact

### Before
- ❌ New users inherit previous user's steps
- ❌ Account switching causes data contamination
- ❌ Inaccurate step counts
- ❌ Coins awarded for steps user didn't walk

### After
- ✅ Each user has isolated step data
- ✅ Account switching is safe
- ✅ Accurate step counts from login time
- ✅ Coins only awarded for actual user's steps

## Related Issues Fixed

This fix also addresses:
- Account switching data isolation (from previous conversation)
- Historical data contamination
- Coin rewards for steps user didn't walk
- Challenge completion for steps user didn't walk
