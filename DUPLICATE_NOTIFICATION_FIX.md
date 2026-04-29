# Duplicate Challenge Notification Fix

## Problem
When users completed challenges, they received **2 duplicate notifications** for each challenge completion.

## Root Cause Analysis

### Notification Flow
1. **Backend** (`challenge.controller.js` line 245):
   - When a challenge is completed, `createNotification()` is called
   - This function does TWO things:
     - ✅ Persists notification to MongoDB
     - ✅ Sends FCM push notification via Firebase

2. **Frontend** (`useNotificationSetup.ts`):
   - Receives the FCM push notification
   - ✅ Displays it via Notifee (correct)
   - ❌ **Called `persistNotification()` which created a DUPLICATE in the database**

### The Bug
The frontend was calling `api.post('user/notifications', ...)` to persist every incoming FCM notification, but the backend had **already persisted** these notifications before sending the FCM push. This resulted in:
- 1 notification created by backend
- 1 duplicate notification created by frontend
- **Total: 2 notifications for each challenge completion**

## Solution

### Changes Made
**File**: `src/hooks/useNotificationSetup.ts`

1. **Removed duplicate persistence calls** in 3 places:
   - Foreground FCM handler (step 4)
   - Background press handler (step 6)
   - Quit-state handler (step 7)

2. **Removed the `persistNotification()` function** entirely since it's no longer needed

3. **Kept query invalidation** to refresh the notification list when FCM pushes arrive

### Before (Causing Duplicates)
```typescript
useEffect(() => {
  const messaging = getMessaging();
  const unsub = onMessage(messaging, async remoteMessage => {
    await displayPushNotification(remoteMessage);
    if (isAuthenticated) {
      await persistNotification(remoteMessage);  // ❌ DUPLICATE!
      qc.invalidateQueries({ queryKey: NOTIF_KEY });
    }
  });
  return unsub;
}, [isAuthenticated, qc]);
```

### After (Fixed)
```typescript
useEffect(() => {
  const messaging = getMessaging();
  const unsub = onMessage(messaging, async remoteMessage => {
    await displayPushNotification(remoteMessage);
    if (isAuthenticated) {
      // Just invalidate to refresh the notification list
      qc.invalidateQueries({ queryKey: NOTIF_KEY });
    }
  });
  return unsub;
}, [isAuthenticated, qc]);
```

## Architecture Notes

### Correct Notification Flow
```
Backend Challenge Completion
    ↓
createNotification() utility
    ↓
├─→ Save to MongoDB (Notification model)
└─→ Send FCM push (sendPushToUser)
        ↓
    Firebase Cloud Messaging
        ↓
    Frontend receives FCM
        ↓
    Display via Notifee
        ↓
    Invalidate queries to refresh list
```

### When to Use `saveIncomingNotification` Endpoint
The `POST /user/notifications` endpoint (`saveIncomingNotification`) should **only** be used for:
- Notifications that originate directly from Firebase/FCM (not from our backend)
- Local device-generated notifications that need to be synced to the server

It should **NOT** be used for notifications that were already created by the backend.

## Testing
To verify the fix:
1. Complete a challenge (e.g., reach 5000 steps)
2. Check the notification list
3. **Expected**: Only 1 notification appears
4. **Before fix**: 2 identical notifications appeared

## Files Modified
- `src/hooks/useNotificationSetup.ts` - Removed duplicate persistence logic

## Related Files (No Changes Needed)
- `athlofit-backend/src/controllers/challenge.controller.js` - Challenge completion logic
- `athlofit-backend/src/utils/createNotification.js` - Notification creation utility
- `athlofit-backend/src/controllers/user.controller.js` - saveIncomingNotification endpoint
- `src/features/health/hooks/useSyncHealth.ts` - Health sync that triggers challenge checks

## Impact
- ✅ Eliminates duplicate notifications for challenge completions
- ✅ Reduces database storage (no duplicate records)
- ✅ Improves user experience (no notification spam)
- ✅ Applies to all notification types (GOAL, CHALLENGE, HYDRATION, etc.)
