# Account Deletion Request Feature

## Overview
Implemented a comprehensive account deletion request system with a 30-day grace period, status tracking, and confirmation dialogs. Users can request account deletion, see the status with countdown, and cancel the request before it's executed.

## Features

### 1. **Request Account Deletion**
- User can request account deletion from Settings screen
- Shows confirmation dialog with detailed warning about data loss
- Sets 30-day grace period before actual deletion
- Sends notification to user about the request

### 2. **Deletion Status Tracking**
Users can see their deletion request status:
- **none**: No deletion request
- **pending**: Deletion requested, waiting for grace period (30 days)
- **in_progress**: Deletion is being processed
- **completed**: Account has been deleted
- **cancelled**: User cancelled the deletion request

### 3. **Status Badge Display**
- Shows countdown badge (e.g., "15d left") when deletion is pending
- Shows "IN PROGRESS" badge when deletion is being processed
- Badge appears next to the cancel deletion option

### 4. **Cancel Deletion Request**
- User can cancel deletion anytime during the 30-day grace period
- Shows confirmation dialog before cancelling
- Sends notification confirming cancellation
- Account returns to normal status

### 5. **Confirmation Dialogs**
- **Delete Account**: Shows detailed warning about data loss
- **Cancel Deletion**: Confirms user wants to keep their account

## Backend Implementation

### Database Schema (User Model)
```javascript
deletionRequest: {
  status: { 
    type: String, 
    enum: ['none', 'pending', 'in_progress', 'completed', 'cancelled'], 
    default: 'none' 
  },
  requestedAt: { type: Date, default: null },
  scheduledDeletionDate: { type: Date, default: null }, // 30 days from request
  reason: { type: String, default: null },
  cancelledAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}
```

### API Endpoints

#### 1. POST `/user/request-deletion`
Request account deletion with optional reason.

**Request Body:**
```json
{
  "reason": "Optional reason for deletion"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account deletion requested",
  "data": {
    "status": "pending",
    "scheduledDeletionDate": "2026-05-27T10:30:00.000Z",
    "requestedAt": "2026-04-27T10:30:00.000Z"
  }
}
```

**Business Logic:**
- Checks if there's already an active deletion request
- Sets status to 'pending'
- Calculates scheduledDeletionDate as 30 days from now
- Sends notification to user
- Returns 400 if deletion request already exists

#### 2. POST `/user/cancel-deletion`
Cancel an active deletion request.

**Response:**
```json
{
  "success": true,
  "message": "Account deletion cancelled",
  "data": {
    "status": "cancelled",
    "cancelledAt": "2026-04-27T10:35:00.000Z"
  }
}
```

**Business Logic:**
- Checks if there's an active deletion request (pending or in_progress)
- Sets status to 'cancelled'
- Records cancelledAt timestamp
- Sends notification to user
- Returns 400 if no active deletion request found

#### 3. GET `/user/deletion-status`
Get current deletion request status.

**Response:**
```json
{
  "success": true,
  "message": "Deletion status fetched",
  "data": {
    "status": "pending",
    "requestedAt": "2026-04-27T10:30:00.000Z",
    "scheduledDeletionDate": "2026-05-27T10:30:00.000Z",
    "reason": "No longer need the app",
    "cancelledAt": null,
    "completedAt": null
  }
}
```

## Frontend Implementation

### File Structure
```
src/features/account/
├── service/
│   └── accountDeletion.service.ts    # API service for deletion endpoints
├── hooks/
│   ├── useAccountDeletion.ts         # Hook for deletion logic & dialogs
│   └── useSettingScreen.ts           # Updated to include deletion
├── components/settings/
│   └── SettingsRow.tsx               # Updated to show badges
├── types/
│   └── setting.types.ts              # Updated with badge support
└── styles/
    └── useSettingStyles.ts           # Added badge styles
```

### Key Components

#### 1. **accountDeletion.service.ts**
Service layer for API calls:
- `requestDeletion(payload)` - Request account deletion
- `cancelDeletion()` - Cancel deletion request
- `getDeletionStatus()` - Get current status

#### 2. **useAccountDeletion.ts**
React hook that provides:
- `deletionStatus` - Current deletion status data
- `requestDeletion()` - Shows confirmation dialog and requests deletion
- `cancelDeletion()` - Shows confirmation dialog and cancels deletion
- `isRequestingDeletion` - Loading state for request
- `isCancellingDeletion` - Loading state for cancellation

**Confirmation Dialogs:**
```typescript
// Delete Account Dialog
Alert.alert(
  'Delete Account?',
  'Are you sure you want to delete your account? This action will schedule your account for permanent deletion in 30 days. You can cancel this request anytime during this period.\n\nAll your data including:\n• Health records\n• Coins and achievements\n• Orders and addresses\n• Challenges and progress\n\nwill be permanently deleted.',
  [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete Account', style: 'destructive', onPress: () => requestDeletionMutation.mutate({ reason }) }
  ]
);

// Cancel Deletion Dialog
Alert.alert(
  'Cancel Deletion Request?',
  'Are you sure you want to cancel your account deletion request? Your account will remain active.',
  [
    { text: 'No', style: 'cancel' },
    { text: 'Yes, Cancel Deletion', style: 'default', onPress: () => cancelDeletionMutation.mutate() }
  ]
);
```

#### 3. **Settings Screen Integration**
The Settings screen now shows:
- **"DELETE ACCOUNT"** button when no active deletion request
- **"CANCEL ACCOUNT DELETION"** button with status badge when deletion is pending/in_progress

**Badge Variants:**
- `warning` - Yellow/orange for pending status with countdown
- `destructive` - Red for critical states
- `success` - Green for successful operations
- `default` - Gray for neutral states

### UI Flow

#### Normal State (No Deletion Request)
```
Settings Screen
└── DANGER ZONE
    └── DELETE ACCOUNT [Trash Icon]
```

#### Pending Deletion State
```
Settings Screen
└── DANGER ZONE
    └── CANCEL ACCOUNT DELETION [Shield Icon] [15d left]
```

#### After Clicking Delete Account
1. Shows confirmation dialog with detailed warning
2. User confirms → API request sent
3. Success → Shows alert with scheduled deletion date
4. Settings screen updates to show "CANCEL ACCOUNT DELETION" with countdown badge

#### After Clicking Cancel Deletion
1. Shows confirmation dialog
2. User confirms → API request sent
3. Success → Shows success alert
4. Settings screen updates to show "DELETE ACCOUNT" again

## Status Badge Logic

```typescript
const daysRemaining = Math.ceil(
  (new Date(scheduledDeletionDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
);

badge: {
  text: status === 'pending' ? `${daysRemaining}d left` : 'IN PROGRESS',
  variant: 'warning',
}
```

## Notifications

### Deletion Requested
```
Title: ⚠️ Account Deletion Requested
Message: Your account is scheduled for deletion on [date]. You can cancel this request anytime before that date.
```

### Deletion Cancelled
```
Title: ✅ Deletion Request Cancelled
Message: Your account deletion request has been cancelled. Your account is safe.
```

## Data That Will Be Deleted

When account deletion is completed (after 30 days), the following data will be permanently deleted:

1. **User Profile**
   - Personal information (name, email, phone, etc.)
   - Avatar and profile pictures
   - Preferences and settings

2. **Health Data**
   - Daily health activities (steps, calories, etc.)
   - BMI records
   - Health metrics history

3. **Gamification Data**
   - Coins balance
   - Streaks and achievements
   - Badges and rewards
   - Claim history

4. **Challenges**
   - User challenge participations
   - Challenge progress

5. **Orders & Shop**
   - Order history
   - Saved addresses
   - Purchase records

6. **Nutrition**
   - Meal logs
   - Nutrition preferences
   - Food search history

7. **Social**
   - Referral data
   - Notifications

8. **Support**
   - Support tickets

## Security Considerations

1. **Authentication Required**: All deletion endpoints require valid JWT token
2. **User Ownership**: Can only delete own account (verified via `req.user._id`)
3. **Grace Period**: 30-day window allows users to change their mind
4. **Audit Trail**: Tracks requestedAt, cancelledAt, completedAt timestamps
5. **Notifications**: User is notified at each step

## Testing Checklist

### Backend Tests
- [ ] Request deletion with valid token
- [ ] Request deletion when already pending (should fail)
- [ ] Request deletion without authentication (should fail)
- [ ] Cancel deletion when pending
- [ ] Cancel deletion when no request exists (should fail)
- [ ] Get deletion status
- [ ] Verify 30-day calculation is correct
- [ ] Verify notifications are sent

### Frontend Tests
- [ ] Settings screen shows "DELETE ACCOUNT" initially
- [ ] Click "DELETE ACCOUNT" shows confirmation dialog
- [ ] Confirm deletion → API called → Success alert shown
- [ ] Settings screen updates to show "CANCEL ACCOUNT DELETION" with badge
- [ ] Badge shows correct days remaining
- [ ] Click "CANCEL ACCOUNT DELETION" shows confirmation dialog
- [ ] Confirm cancellation → API called → Success alert shown
- [ ] Settings screen updates back to "DELETE ACCOUNT"
- [ ] Error handling for API failures

### Edge Cases
- [ ] Network error during request
- [ ] Network error during cancellation
- [ ] User logs out with pending deletion
- [ ] User logs back in → deletion status persists
- [ ] Scheduled deletion date passes (backend cron job needed)

## Future Enhancements

1. **Backend Cron Job**
   - Scheduled job to check for accounts past scheduledDeletionDate
   - Automatically delete accounts with status 'pending' past the date
   - Set status to 'in_progress' → perform deletion → set to 'completed'

2. **Email Notifications**
   - Send email when deletion is requested
   - Send reminder emails (e.g., 7 days before, 1 day before)
   - Send confirmation email when cancelled

3. **Reason Tracking**
   - Collect and analyze deletion reasons
   - Improve product based on feedback

4. **Data Export**
   - Allow users to download their data before deletion
   - GDPR compliance

5. **Admin Dashboard**
   - View pending deletion requests
   - Manually process or cancel deletions
   - Analytics on deletion reasons

## Files Modified/Created

### Backend
- ✅ `athlofit-backend/src/models/User.model.js` - Added deletionRequest schema
- ✅ `athlofit-backend/src/controllers/user.controller.js` - Added 3 new endpoints
- ✅ `athlofit-backend/src/routes/user.routes.js` - Added 3 new routes

### Frontend
- ✅ `src/features/account/service/accountDeletion.service.ts` - NEW
- ✅ `src/features/account/hooks/useAccountDeletion.ts` - NEW
- ✅ `src/features/account/hooks/useSettingScreen.ts` - Updated
- ✅ `src/features/account/service/settingScreenService.ts` - Updated
- ✅ `src/features/account/components/settings/SettingsRow.tsx` - Added badge support
- ✅ `src/features/account/types/setting.types.ts` - Added badge type
- ✅ `src/features/account/styles/useSettingStyles.ts` - Added badge styles

## API Usage Examples

### Request Deletion
```bash
curl -X POST http://localhost:5000/api/user/request-deletion \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "No longer need the app"}'
```

### Cancel Deletion
```bash
curl -X POST http://localhost:5000/api/user/cancel-deletion \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Status
```bash
curl -X GET http://localhost:5000/api/user/deletion-status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Summary

This feature provides a complete account deletion workflow with:
- ✅ User-friendly confirmation dialogs
- ✅ 30-day grace period for cancellation
- ✅ Real-time status tracking with countdown
- ✅ Visual status badges
- ✅ Push notifications at each step
- ✅ Secure backend implementation
- ✅ Clean UI integration in Settings screen

The implementation follows best practices for account deletion, giving users control while protecting against accidental deletions.
