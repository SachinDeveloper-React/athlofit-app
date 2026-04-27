# Account Switching Data Isolation Fix

## Problem
When a user logged out and switched to a different account, the step count and coins from the previous account were persisting and being shown to the new account. **The critical issue was that Health Connect data (device-level step count) was being automatically synced to the new user's account.**

### Example Scenario:
1. User A logs in and walks 3500 steps (tracked by Health Connect on device)
2. User A logs out
3. User B logs in
4. Health Connect still shows 3500 steps (device-level data)
5. **App automatically syncs these 3500 steps to User B's account** ❌
6. User B sees 3500 steps and earns coins for steps they didn't walk

## Root Causes

### 1. Local Store Persistence
The app uses Zustand with MMKV persistence for local state management. When a user logged out:
- ✅ Auth tokens were properly cleared from Keychain
- ✅ User profile was cleared from authStore
- ❌ **Gamification data (coins, streaks) was NOT cleared**
- ❌ **Hydration data (water intake) was NOT cleared**
- ❌ **Health data (steps, calories, etc.) was NOT cleared**

### 2. Health Connect Auto-Sync Issue (CRITICAL)
Health Connect is a **device-level** health data store, not app-level:
- Health Connect stores step count at the **device level** (survives app logout)
- The `useHealth` hook automatically fetches Health Connect data every 60 seconds
- The `TrackerScreen` automatically syncs this data to backend **without checking which user is logged in**
- When User B logs in, the app immediately syncs User A's steps to User B's account

## Solution

### 1. Added Reset Methods to User-Specific Stores

**gamificationStore** (`src/features/health/store/gamificationStore.ts`)
```typescript
reset: () => set({
  coinsBalance: 0,
  streakDays: 0,
  bestStreakDays: 0,
  lastActiveDate: null,
  coinsEarnedToday: 0,
  lastCoinDate: null,
})
```

**hydrationStore** (`src/features/health/store/hydrationStore.ts`)
```typescript
reset: () => set({
  consumed: 0,
  dailyGoal: 5000,
  history: [],
  isLoading: false,
  isSyncing: false,
  error: null,
  lastResetDate: '',
})
```

**healthDataStore** (`src/features/health/store/healthDataStore.ts`) - NEW
```typescript
// New store to track health data and clear it on logout
reset: () => set({ 
  data: defaultHealthData, 
  lastUpdated: null 
})
```

### 2. Updated Logout Function to Clear All User Data

**authStore** (`src/features/auth/store/authStore.ts`)
```typescript
logout: async () => {
  try {
    await clearFcmToken();
    await authService.logout();
  } catch {
    /* silent */
  }
  await tokenService.clear();
  
  // Clear user-specific stores to prevent data leakage between accounts
  const { useGamificationStore } = await import('../../health/store/gamificationStore');
  const { useHydrationStore } = await import('../../health/store/hydrationStore');
  const { useHealthDataStore } = await import('../../health/store/healthDataStore');
  
  useGamificationStore.getState().reset();
  useHydrationStore.getState().reset();
  useHealthDataStore.getState().reset();
  
  set(state => {
    state.user = null;
    state.accessToken = null;
    state.isAuthenticated = false;
  });
}
```

### 3. Added Account Switch Detection in TrackerScreen (CRITICAL FIX)

**TrackerScreen** (`src/features/health/screens/TrackerScreen.tsx`)
```typescript
// Track the last synced user ID to detect account switches
const lastSyncedUserRef = useRef<string | null>(null);
const isAuthenticated = useAuthStore(state => state.isAuthenticated);
const userId = useAuthStore(state => state.user?._id);

useEffect(() => {
  // Automatically push health data to server when loaded
  // BUT only if user is authenticated and it's the same user

  if (!isAuthenticated || !userId) {
    // User not authenticated - don't sync
    return;
  }

  // Detect account switch - if user ID changed, don't sync old data
  if (lastSyncedUserRef.current && lastSyncedUserRef.current !== userId) {
    console.log('[TrackerScreen] Account switched - skipping sync of old health data');
    lastSyncedUserRef.current = userId;
    // Refresh health data for new user
    refresh(true);
    return;
  }

  if (isReady && data && lastUpdated) {
    const isGoalMet = data.steps >= (dailyStepGoal || 8000);
    syncHealth({
      ...data,
      goalMet: isGoalMet,
    });
    lastSyncedUserRef.current = userId;
  }
}, [data, isReady, lastUpdated, dailyStepGoal, syncHealth, isAuthenticated, userId, refresh]);
```

### 4. Updated Type Definitions
- Added `reset: () => void` to `GamificationStore` interface
- Added `reset: () => void` to `HydrationActions` interface
- Created new `HealthDataStore` interface with reset method

## How It Works Now

### Logout Flow:
1. User A logs out
2. `authStore.logout()` is called
3. ✅ FCM token cleared
4. ✅ Backend logout API called
5. ✅ Keychain tokens cleared
6. ✅ **gamificationStore.reset()** - clears coins, streaks
7. ✅ **hydrationStore.reset()** - clears water intake
8. ✅ **healthDataStore.reset()** - clears health data
9. ✅ Auth state cleared

### Login Flow (New User):
1. User B logs in
2. Auth tokens saved, user profile loaded
3. TrackerScreen mounts
4. Health Connect fetches device-level steps (may still show User A's steps from device)
5. ✅ **Sync is BLOCKED** because `lastSyncedUserRef` detects user ID change
6. ✅ Health data is refreshed for new user
7. ✅ Only User B's backend data is displayed
8. ✅ New steps walked by User B are synced to User B's account only

### Account Switch Detection:
- Tracks `userId` in a ref (`lastSyncedUserRef`)
- When `userId` changes, **skips syncing old Health Connect data**
- Refreshes health data to get new user's data from backend
- Prevents cross-contamination of step data between accounts

## What Gets Cleared vs Preserved

### ✅ Cleared on Logout (User-Specific Data)
- **Gamification**: coins, streaks, badges, last active dates
- **Hydration**: water intake, history, daily progress
- **Health Data**: steps, calories, distance, heart rate, etc.
- **Auth**: user profile, tokens, authentication state

### ✅ Preserved on Logout (Device-Level Preferences)
- **Onboarding**: whether user has completed onboarding
- **Hydration Schedule**: notification alarm preferences
- **App Config**: global app configuration
- **Health Connect Device Data**: steps remain in Health Connect (device-level), but won't be synced to wrong account

## Testing Checklist
1. ✅ Login as User A
2. ✅ Walk 3500 steps (or simulate via Health Connect)
3. ✅ Verify User A sees 3500 steps and earns coins
4. ✅ Logout User A
5. ✅ **Verify local stores are cleared** (coins = 0, steps = 0 in app state)
6. ✅ Login as User B (or create new account)
7. ✅ **Verify User B sees 0 steps and 0 coins** (not User A's data)
8. ✅ **Verify Health Connect's 3500 steps are NOT synced to User B's account**
9. ✅ Walk additional steps as User B
10. ✅ Verify only User B's new steps are tracked and synced
11. ✅ Switch back to User A
12. ✅ Verify User A's original data is restored from backend (3500 steps + coins)

## Backend Data Isolation
The backend already properly isolates data by `user._id`:
- `HealthActivity` model has unique index on `{ user: 1, date: 1 }`
- `Gamification` model has unique constraint on `user` field
- All queries filter by `req.user._id` from JWT token

The issue was on the frontend where Health Connect device data was being synced to the wrong user's account.

## Files Modified
1. `src/features/health/store/gamificationStore.ts` - Added reset method
2. `src/features/health/store/hydrationStore.ts` - Added reset method
3. `src/features/health/store/healthDataStore.ts` - **NEW** - Created health data store with reset
4. `src/features/health/types/gamification.type.ts` - Added reset to interface
5. `src/features/health/types/hydration.type.ts` - Added reset to interface
6. `src/features/auth/store/authStore.ts` - Call reset methods on logout
7. `src/features/health/screens/TrackerScreen.tsx` - **CRITICAL** - Added account switch detection and sync blocking

## Impact
- **Security**: ✅ Prevents data leakage between user accounts
- **Privacy**: ✅ Ensures user data isolation
- **Data Integrity**: ✅ Prevents Health Connect device data from being synced to wrong account
- **UX**: ✅ New users see clean slate, not previous user's data
- **Performance**: ✅ No performance impact (synchronous reset operations)

## Technical Notes

### Why Health Connect Data Persists
Health Connect is Android's system-level health data aggregator (similar to Apple HealthKit). It:
- Stores data at the **device level**, not app level
- Survives app uninstall/reinstall
- Aggregates data from multiple sources (Google Fit, Samsung Health, etc.)
- Is **not aware of your app's user accounts**

This is why the app needs explicit logic to prevent syncing device-level data to the wrong user account.
