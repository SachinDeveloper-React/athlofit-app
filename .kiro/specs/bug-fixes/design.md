# Design Document — Bug Fixes

## Overview

This document describes the implementation approach for all 52 bugs across the Athlofit backend (Node.js/Express + MongoDB) and frontend (React Native/TypeScript). Fixes are grouped by file or functional area. Each section identifies the root cause, the precise change required, and any side-effects to consider.

The dominant language for the backend is **JavaScript (Node.js)**; the frontend is **TypeScript (React Native)**.

---

## Architecture

No architectural changes are required. All fixes are surgical edits to existing files. The groupings below mirror the task plan.

```
athlofit-backend/src/
  index.js                  ← BUG-001: create server.js
  app.js                    ← BUG-002, BUG-003
  config/db.js              ← BUG-004
  utils/otp.js              ← BUG-005, BUG-006
  utils/jwt.js              ← BUG-007, BUG-008
  utils/createNotification.js ← BUG-009
  controllers/
    auth.controller.js      ← BUG-010, BUG-011, BUG-012, BUG-013
    user.controller.js      ← BUG-014, BUG-015, BUG-016
    health.controller.js    ← BUG-017, BUG-018, BUG-019, BUG-020, BUG-021
    challenge.controller.js ← BUG-022, BUG-023, BUG-024
    gamification.controller.js ← BUG-025, BUG-026, BUG-027, BUG-028
    shop.controller.js      ← BUG-029, BUG-030, BUG-031, BUG-032, BUG-033
    referral.controller.js  ← BUG-034
    notification.controller.js ← BUG-035
    config.controller.js    ← BUG-036
  models/
    User.model.js           ← BUG-037, BUG-038
    Order.model.js          ← BUG-039
  routes/shop.routes.js     ← BUG-040

src/
  app/App.tsx               ← BUG-041, BUG-042, BUG-043
  utils/api.ts              ← BUG-044, BUG-045, BUG-046
  features/auth/store/authStore.ts ← BUG-047, BUG-048
  features/health/store/gamificationStore.ts ← BUG-049
  features/shop/context/CartContext.tsx ← BUG-050, BUG-051
  hooks/useNotificationSetup.ts ← BUG-052
```

---

## Component Designs

### 1. Server Entry Point (`index.js` / `server.js`) — BUG-001

**Root cause:** `index.js` requires `./server` which does not exist.

**Fix:** Create `athlofit-backend/src/server.js`:

```javascript
// src/server.js
const { connectDB } = require('./config/db');
const app = require('./app');

const PORT = process.env.PORT || 5001;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
```

`index.js` already does `require('./server')` so no change to `index.js` is needed once `server.js` exists.

---

### 2. App.js — Rate Limiting and CORS (`app.js`) — BUG-002, BUG-003

**BUG-002 root cause:** The global `limiter` is applied with `app.use(limiter)` before routes, and then `/auth` routes also get `authLimiter`. This double-limits auth requests.

**Fix:** Apply the global limiter only to non-auth routes:

```javascript
// Apply global limiter to all routes EXCEPT /auth
app.use((req, res, next) => {
  if (req.path.startsWith('/auth')) return next();
  return limiter(req, res, next);
});
```

**BUG-003 root cause:** `origin: process.env.CLIENT_URL || '*'` silently falls back to wildcard.

**Fix:** Add a startup guard:

```javascript
if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_URL) {
  throw new Error('CLIENT_URL environment variable is required in production');
}
```

---

### 3. Database Config (`config/db.js`) — BUG-004

**Root cause:** `console.log("process.env.MONGO_URI", process.env.MONGO_URI)` leaks credentials.

**Fix:** Remove that single line entirely.

---

### 4. OTP Utility (`utils/otp.js`) — BUG-005, BUG-006

**BUG-005 root cause:** `Math.random()` is not a CSPRNG.

**Fix:**
```javascript
const generateOtp = () => crypto.randomInt(100000, 1000000).toString();
```

**BUG-006 root cause:** `createTransport()` is called inside `sendOtpEmail` on every invocation.

**Fix:** Move transporter creation to module level:

```javascript
const port = Number(process.env.SMTP_PORT) || 587;
const secure = port === 465;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const sendOtpEmail = async (to, otp, flow) => {
  // ... use module-level transporter
  await transporter.sendMail({ ... });
};
```

---

### 5. JWT Utility (`utils/jwt.js`) — BUG-007, BUG-008

**BUG-007 root cause:** Default expiry `"30d"` is far too long for an access token.

**Fix:**
```javascript
expiresIn: process.env.JWT_EXPIRES_IN || "15m",
```

**BUG-008 root cause:** In `rotateRefreshToken`, the condition `!stored || stored.expiresAt < now` treats both "not found" and "expired" the same as "revoked", revoking all sessions for an expired token.

**Fix:** Separate the cases:

```javascript
// Token not found at all — could be reuse of an already-rotated token
if (!stored) {
  return null; // Cannot identify user, cannot revoke
}

// Token found but expired (rolling window) — just return null, don't revoke
if (stored.expiresAt < now) {
  return null;
}

// Token found, not expired, but already revoked — reuse attack
if (stored.revoked) {
  await RefreshToken.updateMany({ user: stored.user }, { revoked: true });
  return null;
}
```

---

### 6. Notification Utility (`utils/createNotification.js`) — BUG-009

**Root cause:** The count→find→delete sequence is not atomic, allowing the cap to be exceeded under concurrent requests.

**Fix:** Use a single atomic `$push` with `$slice` to maintain the cap:

```javascript
await Notification.findOneAndUpdate(
  { user: userId },
  {
    $push: {
      notifications: {
        $each: [newNotification],
        $slice: -MAX_NOTIFICATIONS, // keep only the most recent N
      },
    },
  },
  { upsert: true, new: true }
);
```

If the model stores notifications as a top-level collection (not embedded), use a MongoDB session:

```javascript
const session = await mongoose.startSession();
session.startTransaction();
try {
  const count = await Notification.countDocuments({ user: userId }).session(session);
  if (count >= MAX_NOTIFICATIONS) {
    const oldest = await Notification.find({ user: userId })
      .sort({ createdAt: 1 })
      .limit(count - MAX_NOTIFICATIONS + 1)
      .session(session);
    await Notification.deleteMany({ _id: { $in: oldest.map(n => n._id) } }).session(session);
  }
  await Notification.create([{ ...notificationData }], { session });
  await session.commitTransaction();
} catch (err) {
  await session.abortTransaction();
  throw err;
} finally {
  session.endSession();
}
```

---

### 7. Auth Controller (`controllers/auth.controller.js`) — BUG-010, BUG-011, BUG-012, BUG-013

**BUG-010:** Return `user.toJSON()` in `verifySignupOtp` to strip OTP fields via the schema transform.

**BUG-011:** In `resendOtp`, add a guard:
```javascript
if (flow === 'signup' && user.emailVerified) {
  return error(res, 'Email is already verified', 400);
}
```

**BUG-012:** In `resetPassword`, add:
```javascript
if (!newPassword || newPassword.length < 8) {
  return error(res, 'Password must be at least 8 characters', 400);
}
```

**BUG-013:** In Google login handler, only update `avatarUrl` if the new value is non-null:
```javascript
if (googleUser.photo) {
  user.avatarUrl = googleUser.photo;
}
```

---

### 8. User Controller (`controllers/user.controller.js`) — BUG-014, BUG-015, BUG-016

**BUG-014:** Replace year-only age calculation with:
```javascript
const dob = new Date(user.dob);
const today = new Date();
let age = today.getFullYear() - dob.getFullYear();
const m = today.getMonth() - dob.getMonth();
if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
  age--;
}
```

**BUG-015:** Remove the inner `require('../models/Notification.model')` — the model is already imported at the top of the file.

**BUG-016:** Remove `avatarUrl` from the `allowedFields` array in the profile update handler.

---

### 9. Health Controller (`controllers/health.controller.js`) — BUG-017, BUG-018, BUG-019, BUG-020, BUG-021

**BUG-017:** Add a `stepGoalCoinDate` field to the `Gamification` model and use it in the step-goal coin block:
```javascript
// Passive coins use lastCoinDate
// Step-goal coins use stepGoalCoinDate
if (gam.stepGoalCoinDate !== today) {
  // award step-goal coins
  gam.stepGoalCoinDate = today;
}
```

**BUG-018:** Track a dirty flag in `_updateStreak`:
```javascript
let dirty = false;
// ... only set dirty = true when a field actually changes
if (dirty) await gam.save();
```

**BUG-019:** For year analytics quarterly grouping, compute relative index:
```javascript
// months is an array of the 12 months in the window, index 0–11
const quarter = Math.floor(relativeIndex / 3); // 0, 1, 2, or 3
```

**BUG-020:** Ensure height is stored in cm in `BmiRecord`. When reading from the `User` model (already in cm), pass the value directly. Add a comment clarifying the unit.

**BUG-021:** Validate `from` and `to` in `getWeeklySteps`:
```javascript
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
if (!ISO_DATE_RE.test(from) || !ISO_DATE_RE.test(to)) {
  return error(res, 'from and to must be valid ISO date strings (YYYY-MM-DD)', 400);
}
```

---

### 10. Challenge Controller (`controllers/challenge.controller.js`) — BUG-022, BUG-023, BUG-024

**BUG-022:** Change `currentValue = mealsLoggedCount` to `currentValue = weeklyMealLogs.length`.

**BUG-023:** Reorder operations — save `gam` first, then set `isRewarded: true` and save the challenge:
```javascript
await gam.save();           // save coins first
challenge.isRewarded = true;
await challenge.save();     // then mark rewarded
```

**BUG-024:** Replace the non-standard week number calculation with ISO week:
```javascript
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
```

---

### 11. Gamification Controller (`controllers/gamification.controller.js`) — BUG-025, BUG-026, BUG-027, BUG-028

**BUG-025:** In `claimReward`, before awarding streak badge coins, apply the daily cap:
```javascript
const remainingAllowance = MAX_DAILY_COINS - (gam.coinsEarnedToday || 0);
const actualCoins = Math.round(Math.min(rewardDef.reward, remainingAllowance));
gam.coinsBalance = Math.round(gam.coinsBalance + actualCoins);
gam.coinsEarnedToday = Math.round((gam.coinsEarnedToday || 0) + actualCoins);
```

**BUG-026:** Filter null users from leaderboard:
```javascript
const data = top
  .filter(g => g.user != null)
  .map((g, i) => ({ ... }));
```

**BUG-027:** Remove `allActivities` from the transaction list in `getCoinData`. Step-goal coins are already in `claimHistory`.

**BUG-028:** In `syncGamification`, validate `lastActiveDate`:
```javascript
if (lastActiveDate !== undefined) {
  const d = new Date(lastActiveDate);
  if (isNaN(d.getTime()) || lastActiveDate > todayISO()) {
    return error(res, 'lastActiveDate must be a valid ISO date not in the future', 400);
  }
  gam.lastActiveDate = lastActiveDate;
}
```

---

### 12. Shop Controller (`controllers/shop.controller.js`) — BUG-029, BUG-030, BUG-031, BUG-032, BUG-033

**BUG-029:** Wrap `buyWithCoins` in a MongoDB session/transaction:
```javascript
const session = await mongoose.startSession();
session.startTransaction();
try {
  // stock decrement, coin deduction, order creation — all with { session }
  await session.commitTransaction();
} catch (err) {
  await session.abortTransaction();
  throw err;
} finally {
  session.endSession();
}
```

**BUG-030:**
```javascript
gamification.coinsBalance = Math.round(gamification.coinsBalance - finalCoinCost);
```

**BUG-031:**
```javascript
gam.coinsBalance = Math.round(gam.coinsBalance + order.totalCoins);
```

**BUG-032:** Escape regex input:
```javascript
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// then:
filter.$or = [
  { name: { $regex: escapeRegex(search), $options: 'i' } },
  { description: { $regex: escapeRegex(search), $options: 'i' } },
  { tags: { $in: [new RegExp(escapeRegex(search), 'i')] } },
];
```

**BUG-033:** Replace the two-query pattern in `getAvailableCoupons` with a single query that includes `usedBy` and `perUserLimit`, then filter in memory:
```javascript
const coupons = await Coupon.find({ isActive: true, ... })
  .select('+usedBy +perUserLimit')
  .lean();
// filter in memory — no second round-trip needed
```

---

### 13. Shop Routes (`routes/shop.routes.js`) — BUG-040

**Root cause:** `GET /products/:id/reviews` is not behind the `authenticate` middleware.

**Fix option A (preferred):** Add `authenticate` middleware to the route.
**Fix option B:** Strip `user.name` and `user.avatarUrl` from the response before returning.

---

### 14. Referral Controller (`controllers/referral.controller.js`) — BUG-034

**Root cause:** Coins are awarded before `Referral.create` is called.

**Fix:** Move all coin award logic to after `await Referral.create(...)` succeeds.

---

### 15. Notification Controller (`controllers/notification.controller.js`) — BUG-035

**Root cause:** `.catch(() => {})` silently swallows errors.

**Fix:**
```javascript
.catch((err) => console.error('[Notification] insertMany failed:', err));
```

---

### 16. Config Controller (`controllers/config.controller.js`) — BUG-036

**Root cause:** `insertMany` with `ordered: true` (default) aborts on first duplicate.

**Fix:**
```javascript
await Faq.insertMany(faqs, { ordered: false });
```

---

### 17. User Model (`models/User.model.js`) — BUG-037, BUG-038

**BUG-037:** Remove `null` from the gender enum:
```javascript
gender: { type: String, enum: ['M', 'F', 'O'], default: null },
```

**BUG-038:** Guard `comparePassword` for OAuth users:
```javascript
userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};
```

---

### 18. Order Model (`models/Order.model.js`) — BUG-039

**Root cause:** `shippingAddress` sub-fields have no `required` constraint.

**Fix:**
```javascript
shippingAddress: {
  street:  { type: String, required: true },
  city:    { type: String, required: true },
  state:   { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, default: 'India' },
},
```

---

### 19. Frontend: App.tsx — BUG-041, BUG-042, BUG-043

**BUG-041:** Wrap the `onBackgroundEvent` handler body in try/catch:
```typescript
notifee.onBackgroundEvent(async ({ type, detail }) => {
  try {
    if (type === EventType.DELIVERED && detail.notification?.id === 'hydration_midnight_reset') {
      const { setHistory, setConsumed } = useHydrationStore.getState();
      setHistory([]);
      setConsumed(0);
    }
  } catch (err) {
    console.error('[Background event] error:', err);
  }
});
```

**BUG-042:** Move `QueryClient` creation inside the `App` component:
```typescript
const App: React.FC = () => {
  const [queryClient] = React.useState(() => new QueryClient({ ... }));
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
};
```

**BUG-043:** Stabilise `checkAndResetIfNewDay` with `useCallback` and remove the eslint suppression:
```typescript
const checkAndResetIfNewDay = useHydrationStore(
  useCallback(s => s.checkAndResetIfNewDay, [])
);
// In the useEffect dependency array: [checkAndResetIfNewDay]
// Remove: // eslint-disable-next-line react-hooks/exhaustive-deps
```

---

### 20. Frontend: API Utility (`src/utils/api.ts`) — BUG-044, BUG-045, BUG-046

**BUG-044:**
```typescript
export const BASE_URL =
  process.env.REACT_APP_API_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:5001/' : 'http://localhost:5001/');
```

**BUG-045:** After `await refreshPromise`, check `isLoggingOut()` before saving:
```typescript
const refreshed = await refreshPromise;
if (refreshed && !isLoggingOut()) {
  return request<T>(endpoint, { ...options, retry: true });
}
```

**BUG-046:** In `tryRefresh`, validate tokens before saving:
```typescript
if (!newAccessToken || !newRefreshToken) return false;
await tokenService.save({ accessToken: newAccessToken, refreshToken: newRefreshToken });
```

---

### 21. Frontend: Auth Store (`src/features/auth/store/authStore.ts`) — BUG-047, BUG-048

**BUG-047:** Make `setAuth` async and await the token save:
```typescript
setAuth: async (user: User, tokens: AuthTokens) => {
  await tokenService.save(tokens);
  set(state => { ... });
  // ...
},
```

**BUG-048:** Wrap each dynamic import in `logout` in try/catch:
```typescript
try {
  const { useGamificationStore } = await import('../../health/store/gamificationStore');
  useGamificationStore.getState().reset();
} catch (err) {
  console.error('[logout] failed to reset gamificationStore:', err);
}
// repeat for hydrationStore and healthDataStore
```

---

### 22. Frontend: Gamification Store (`src/features/health/store/gamificationStore.ts`) — BUG-049

**Root cause:** `new Date().toISOString().slice(0, 10)` returns UTC date, which is wrong for UTC+ users after midnight UTC but before local midnight.

**Fix:**
```typescript
const getLocalDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
// Replace all occurrences of new Date().toISOString().slice(0, 10) with getLocalDateString()
```

---

### 23. Frontend: Cart Context (`src/features/shop/context/CartContext.tsx`) — BUG-050, BUG-051

**BUG-050:** In the purchase mutation's `onSuccess` callback (wherever `buyWithCoins` is called), call `clearCart()`.

**BUG-051:** In `shop.types.ts` (or wherever `Product` is defined), ensure:
```typescript
discountedPrice: number | null;
```
not `number | undefined`.

---

### 24. Frontend: Notification Setup Hook (`src/hooks/useNotificationSetup.ts`) — BUG-052

**Root cause:** The `useEffect` with `handleQuitState` runs on every mount because it has no guard.

**Fix:** Use a module-level ref (or a `useRef` initialised to `false`) to ensure `getInitialNotification` runs only once:
```typescript
const initialNotificationHandled = useRef(false);

useEffect(() => {
  if (initialNotificationHandled.current) return;
  initialNotificationHandled.current = true;

  const handleQuitState = async () => { ... };
  handleQuitState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

---

## Components and Interfaces

All fixes are surgical edits to existing components. No new components are introduced. The interfaces below describe the changed signatures.

### `server.js` (new file)
```javascript
// Exports nothing — side-effect module that starts the HTTP server
connectDB(): Promise<void>
app.listen(port: number, callback: () => void): http.Server
```

### `generateOtp(): string`
- Before: returns a string produced by `Math.random()`
- After: returns a 6-digit string produced by `crypto.randomInt(100000, 1000000)`

### `rotateRefreshToken(oldToken, ip, userAgent): Promise<{accessToken, refreshToken, userId} | null>`
- Before: treats expired and revoked tokens identically (revokes all sessions)
- After: expired → return null; revoked → revoke all sessions; not found → return null

### `setAuth(user: User, tokens: AuthTokens): Promise<void>` (Auth Store)
- Before: synchronous, does not await `tokenService.save`
- After: async, awaits `tokenService.save(tokens)`

### `getLocalDateString(): string` (Gamification Store — new helper)
- Returns `YYYY-MM-DD` using local device timezone methods

### `escapeRegex(str: string): string` (Shop Controller — new helper)
- Escapes all regex special characters in a user-supplied string

### `getISOWeek(date: Date): number` (Challenge Controller — new helper)
- Returns ISO 8601 week number (1–53) for a given date

---

## Data Models

### Gamification Model — new field

```javascript
stepGoalCoinDate: { type: String, default: null }
// Tracks the last date step-goal coins were awarded, independently of
// lastCoinDate (which tracks passive step coins). Fixes BUG-017.
```

### User Model — enum change

```javascript
// Before:
gender: { type: String, enum: ['M', 'F', 'O', null], default: null }
// After:
gender: { type: String, enum: ['M', 'F', 'O'], default: null }
// Fixes BUG-037: null in enum causes inconsistent Mongoose validation
```

### Order Model — required fields

```javascript
// Before:
shippingAddress: {
  street: String, city: String, state: String, zipCode: String, country: String
}
// After:
shippingAddress: {
  street:  { type: String, required: true },
  city:    { type: String, required: true },
  state:   { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, default: 'India' },
}
// Fixes BUG-039: orders could be placed with empty address
```

---

## Data Model Changes (Summary)

| Model | Change | Bug |
|---|---|---|
| `Gamification` | Add `stepGoalCoinDate: { type: String, default: null }` | BUG-017 |
| `User` | Remove `null` from gender enum | BUG-037 |
| `Order` | Add `required: true` to `street`, `city`, `state`, `zipCode` | BUG-039 |

---

## Testing Strategy

### Unit Tests
Each bug fix should have at minimum one example-based unit test verifying the corrected behaviour. Focus areas:
- JWT token expiry and rotation logic (`utils/jwt.js`)
- OTP generation format (`utils/otp.js`)
- Auth controller guards (`resendOtp`, `resetPassword`, `verifySignupOtp`)
- User model `comparePassword` for OAuth users
- Order model validation for missing address fields
- Age calculation correctness for boundary dates

### Property-Based Tests
Property tests are appropriate for the 13 properties defined in the Correctness Properties section. Use a property-based testing library (e.g., `fast-check` for JavaScript/TypeScript) with a minimum of 100 iterations per property. Each property test must reference its property number from this document.

### Integration Tests
- `buyWithCoins` transaction atomicity: simulate `Order.create` failure and verify rollback
- `GET /products/:id/reviews` PII exposure: call without auth and verify no name/avatarUrl in response
- Referral coin award ordering: verify `Referral` record exists before coins are credited

### What NOT to Test with PBT
- MongoDB connection and startup behaviour (smoke tests)
- Rate limiter configuration (example-based)
- CORS wildcard guard (example-based)
- Notification channel setup (smoke tests)

---

## Error Handling

- All MongoDB transaction blocks use try/catch/finally with `session.abortTransaction()` on failure.
- All dynamic imports in the frontend `logout` function are individually wrapped in try/catch.
- The `notifee.onBackgroundEvent` handler is wrapped in try/catch.
- `Notification.insertMany` errors are logged, not swallowed.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: OTP is always a 6-digit numeric string

*For any* call to `generateOtp()`, the returned value SHALL be a string of exactly 6 decimal digits (i.e., matching `/^\d{6}$/`).

**Validates: Requirements 4.1**

---

### Property 2: Password reset rejects short passwords

*For any* string of length less than 8 characters passed as the new password to `resetPassword`, the controller SHALL return a 400 error and SHALL NOT update the user's password.

**Validates: Requirements 6.3**

---

### Property 3: Age calculation is always correct to the day

*For any* date of birth string in `YYYY-MM-DD` format, the calculated age SHALL equal the number of complete years elapsed since that date as of today, accounting for month and day boundaries.

**Validates: Requirements 7.1**

---

### Property 4: Date validation rejects non-ISO strings

*For any* string that does not match `YYYY-MM-DD` format passed as `from` or `to` in `getWeeklySteps`, the controller SHALL return a 400 error.

**Validates: Requirements 8.1**

---

### Property 5: Year analytics always produces exactly 4 quarters

*For any* 12-month analytics window, the quarterly grouping SHALL produce exactly 4 groups, each containing data from exactly 3 consecutive months in the window.

**Validates: Requirements 8.4**

---

### Property 6: ISO week number is always between 1 and 53

*For any* calendar date, the ISO week calculation SHALL return an integer between 1 and 53 inclusive, and the week boundaries SHALL align with ISO 8601 (weeks start on Monday).

**Validates: Requirements 9.1**

---

### Property 7: Leaderboard never contains null user entries

*For any* leaderboard result set, every entry SHALL have a non-null `userId`, `name`, and `avatarUrl` field (or a defined fallback).

**Validates: Requirements 10.1**

---

### Property 8: lastActiveDate sync rejects future dates

*For any* ISO date string that represents a date strictly after today's local date, `syncGamification` SHALL return a 400 error and SHALL NOT update `lastActiveDate`.

**Validates: Requirements 10.3**

---

### Property 9: Coin balance arithmetic is always integer-valued

*For any* coin deduction or refund operation involving a non-integer coin cost, the resulting `coinsBalance` SHALL be an integer (i.e., `Number.isInteger(coinsBalance)` is true).

**Validates: Requirements 11.2, 11.3**

---

### Property 10: Regex-escaped search strings contain no unescaped special characters

*For any* user-supplied search string, the escaped version SHALL not contain any unescaped regex special characters (`.*+?^${}()|[\]`), meaning the escaped string matches only its literal content.

**Validates: Requirements 11.4**

---

### Property 11: Order creation fails for missing required address fields

*For any* attempt to create an `Order` document with a `shippingAddress` missing `street`, `city`, `state`, or `zipCode`, the Mongoose validation SHALL reject the document with a `ValidationError`.

**Validates: Requirements 16.1**

---

### Property 12: tryRefresh returns false for empty/null tokens

*For any* server response where `accessToken` or `refreshToken` is null, undefined, or an empty string, `tryRefresh` SHALL return `false` and SHALL NOT call `tokenService.save`.

**Validates: Requirements 19.3**

---

### Property 13: Local date string matches device timezone

*For any* moment in time, `getLocalDateString()` SHALL return a `YYYY-MM-DD` string that matches the device's local calendar date, not the UTC calendar date.

**Validates: Requirements 21.1**
