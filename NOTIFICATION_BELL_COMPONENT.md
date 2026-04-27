# Notification Bell Component with Badge Count

## Overview
Created a reusable `NotificationBell` component that displays a bell icon with an unread notification count badge. This component is now used consistently in both the Tracker screen and Account screen.

## Features

### ✨ Key Features
1. **Consistent Design** - Same notification icon in both screens
2. **Live Badge Count** - Shows real-time unread notification count
3. **Auto-Updates** - Badge updates automatically when notifications change
4. **Customizable** - Configurable size, colors, and badge visibility
5. **Press Animation** - Smooth scale animation on press
6. **Smart Display** - Shows "99+" for counts over 99

## Component API

### Props

```typescript
type NotificationBellProps = {
  onPress?: () => void;        // Callback when bell is pressed
  size?: number;               // Icon size (default: 20)
  iconColor?: string;          // Bell icon color (default: theme foreground)
  badgeColor?: string;         // Badge background color (default: theme destructive/red)
  showBadge?: boolean;         // Show/hide badge (default: true)
};
```

### Usage Examples

#### Basic Usage
```typescript
import { NotificationBell } from '../../../components';

<NotificationBell onPress={handleNotificationPress} />
```

#### Custom Size and Color
```typescript
<NotificationBell
  onPress={handleNotificationPress}
  size={24}
  iconColor="#333333"
  badgeColor="#FF0000"
/>
```

#### Without Badge
```typescript
<NotificationBell
  onPress={handleNotificationPress}
  showBadge={false}
/>
```

## Implementation Details

### Component Structure
```
NotificationBell
├── Pressable (with scale animation)
│   └── AppView (iconWrapper)
│       ├── Bell Icon (lucide-react-native)
│       └── Badge (conditional)
│           └── Count Text
```

### Badge Display Logic
- **0 notifications**: Badge hidden
- **1-99 notifications**: Shows exact count (e.g., "5")
- **100+ notifications**: Shows "99+"

### Styling
```typescript
badge: {
  position: 'absolute',
  top: -6,
  right: -6,
  minWidth: 18,
  height: 18,
  borderRadius: 9,
  paddingHorizontal: 4,
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 2,
  borderColor: '#FFFFFF',  // White border for contrast
}
```

## Integration

### 1. Tracker Screen (RightTrackerHeader)

**Location**: `src/features/health/components/tracker/RightTrackerHeader.tsx`

**Before**:
```typescript
<IconButton
  name="BellDot"
  onPress={handleNotification}
  borderColor={colors.border}
  borderRadius={radius.full}
/>
```

**After**:
```typescript
<NotificationBell
  onPress={handleNotification}
  size={20}
  iconColor={colors.foreground}
/>
```

**Visual Position**:
```
[Coins] [Activity] [🔔 5] [Avatar]
                    ↑
              Badge shows count
```

### 2. Account Screen

**Location**: `src/features/account/screens/AccountScreen.tsx`

**Before**:
```typescript
<AccountIconPill onPress={onNotifications}>
  <Icon name="Bell" size={18} color={...} />
  <AppView style={s.dot} />  {/* Static dot */}
</AccountIconPill>
```

**After**:
```typescript
<AccountIconPill onPress={onNotifications}>
  <NotificationBell
    onPress={onNotifications}
    size={18}
    iconColor={withOpacity(colors.foreground, 0.7)}
    showBadge={true}
  />
</AccountIconPill>
```

**Visual Position**:
```
┌─────────────────────────┐
│  [Avatar]               │
│                         │
│         [🔔 3] [⚙️]     │
│          ↑              │
│    Badge with count     │
└─────────────────────────┘
```

## Data Flow

### How Badge Count Updates

1. **Data Source**: `useNotifications()` hook
   - Fetches from: `GET /user/notifications`
   - Returns: `{ notifications: [], unreadCount: number }`

2. **React Query Cache**: 
   - Query Key: `['notifications']`
   - Auto-refetches on focus
   - Updates on mutations (mark read, delete)

3. **Component Updates**:
   - NotificationBell subscribes to `useNotifications()`
   - Badge re-renders when `unreadCount` changes
   - No manual refresh needed

### Update Triggers

Badge count updates automatically when:
- ✅ New notification arrives (via push)
- ✅ User marks notification as read
- ✅ User marks all as read
- ✅ User deletes notification
- ✅ App comes to foreground
- ✅ Query is invalidated

## Files Created/Modified

### Created
1. ✅ `src/components/NotificationBell.tsx` - New component

### Modified
1. ✅ `src/components/index.ts` - Added export
2. ✅ `src/features/health/components/tracker/RightTrackerHeader.tsx` - Use NotificationBell
3. ✅ `src/features/account/screens/AccountScreen.tsx` - Use NotificationBell

## Visual Design

### Badge Appearance

```
     ┌─────┐
     │ 🔔  │ ← Bell icon
     └─────┘
        ╲
         ╲  ┌────┐
          ╲ │ 5  │ ← Red badge with white border
            └────┘
```

### Colors
- **Badge Background**: `colors.destructive` (red)
- **Badge Border**: `#FFFFFF` (white, 2px)
- **Badge Text**: `#FFFFFF` (white, bold)
- **Icon**: Customizable (default: `colors.foreground`)

### Sizes
- **Badge**: 18px height, min 18px width
- **Badge Text**: 10px, weight 800
- **Icon**: Configurable (default 20px)

## Accessibility

- ✅ **Touch Target**: Entire Pressable area is tappable
- ✅ **Visual Feedback**: Scale animation on press (0.95x)
- ✅ **High Contrast**: White text on red background
- ✅ **Clear Indicator**: Badge positioned clearly on icon

## Performance

- ✅ **Memoized**: Component wrapped in `memo()`
- ✅ **Efficient Queries**: React Query caching
- ✅ **No Polling**: Updates via query invalidation
- ✅ **Optimized Renders**: Only re-renders when count changes

## Testing Checklist

### Tracker Screen
- [ ] Navigate to Tracker screen
- [ ] Verify bell icon appears in header
- [ ] Check badge shows correct count
- [ ] Tap bell → navigates to Notifications
- [ ] Mark notification as read → badge count decreases
- [ ] Badge disappears when count reaches 0

### Account Screen
- [ ] Navigate to Account screen
- [ ] Verify bell icon in profile card
- [ ] Check badge shows same count as Tracker
- [ ] Tap bell → navigates to Notifications
- [ ] Both screens show same count (consistency)

### Badge Display
- [ ] 0 notifications → no badge
- [ ] 1 notification → shows "1"
- [ ] 15 notifications → shows "15"
- [ ] 99 notifications → shows "99"
- [ ] 100+ notifications → shows "99+"

### Real-time Updates
- [ ] Receive new notification → badge increments
- [ ] Mark as read → badge decrements
- [ ] Mark all as read → badge disappears
- [ ] Delete notification → badge decrements

## Benefits

### Before
- ❌ Different icons in different screens (BellDot vs Bell)
- ❌ Static dot indicator (no count)
- ❌ No real-time updates
- ❌ Inconsistent styling
- ❌ Duplicate code

### After
- ✅ Same icon everywhere (Bell with badge)
- ✅ Live count display
- ✅ Auto-updates in real-time
- ✅ Consistent design
- ✅ Reusable component
- ✅ Shows exact count (1-99) or "99+"

## Future Enhancements

1. **Haptic Feedback** - Vibrate on new notification
2. **Animation** - Pulse animation when count increases
3. **Sound** - Optional notification sound
4. **Custom Badge Styles** - Different colors for different notification types
5. **Accessibility Labels** - Screen reader support

## Summary

The `NotificationBell` component provides:
- 🔔 Consistent notification icon across app
- 🔴 Live badge count display
- 🔄 Auto-updates with React Query
- 🎨 Customizable appearance
- 📱 Better UX with real count visibility
- ♻️ Reusable and maintainable code

Users can now see exactly how many unread notifications they have at a glance, in both the Tracker and Account screens!
