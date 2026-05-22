# Requirements Document

## Introduction

This document captures the requirements for fixing all 52 known bugs in the Athlofit project, which consists of a React Native mobile frontend and a Node.js/Express backend. The bugs span security vulnerabilities, data integrity issues, race conditions, incorrect business logic, and frontend state management problems. Fixes are grouped by functional area to enable logical, incremental delivery.

## Glossary

- **Backend**: The Node.js/Express server located in `athlofit-backend/src/`
- **Frontend**: The React Native application located in `src/`
- **Gamification**: The coins, streaks, badges, and rewards subsystem
- **CSPRNG**: Cryptographically Secure Pseudo-Random Number Generator
- **MMKV**: Mobile key-value storage used for persisting frontend state
- **Notifee**: React Native library for local push notification display
- **OTP**: One-Time Password used for email verification and password reset
- **JWT**: JSON Web Token used for access token authentication
- **ReDoS**: Regular Expression Denial of Service attack
- **MongoDB Session**: A MongoDB client session used to wrap multiple operations in an atomic transaction

---

## Requirements

### Requirement 1: Server Entry Point

**User Story:** As a developer, I want the backend server to start successfully, so that the application is available to serve requests.

#### Acceptance Criteria

1. WHEN the backend is started via `node src/index.js`, THE Backend SHALL resolve the `./server` module without a `MODULE_NOT_FOUND` error.
2. THE Backend SHALL expose a `server.js` file that imports `app.js` and calls `app.listen()` with the configured port.

---

### Requirement 2: Rate Limiting Configuration

**User Story:** As a system operator, I want rate limiting applied correctly, so that auth endpoints are not double-limited and the configuration is intentional.

#### Acceptance Criteria

1. WHEN a request is made to any `/auth` route, THE Backend SHALL apply only the auth-specific rate limiter, not both the global and auth-specific limiters.
2. WHILE the application is running in production, THE Backend SHALL reject startup if `CLIENT_URL` is not set in the environment, preventing a CORS wildcard.

---

### Requirement 3: Credential and Secret Hygiene

**User Story:** As a security engineer, I want sensitive credentials never logged to stdout, so that secrets are not exposed in server logs.

#### Acceptance Criteria

1. WHEN the database connection is established, THE Backend SHALL NOT log the `MONGO_URI` environment variable to stdout.
2. WHEN the backend starts in production, THE Backend SHALL validate that `CLIENT_URL` is present and throw a startup error if it is missing.

---

### Requirement 4: OTP Security and Email Transport

**User Story:** As a security engineer, I want OTPs generated with a cryptographically secure source and the email transport reused efficiently, so that OTPs are unpredictable and email sending is performant.

#### Acceptance Criteria

1. WHEN an OTP is generated, THE OTP Generator SHALL use `crypto.randomInt(100000, 1000000)` instead of `Math.random()`.
2. THE Email Transport SHALL be created once at module load time and reused for all subsequent `sendOtpEmail` calls.

---

### Requirement 5: JWT Token Expiry and Rotation

**User Story:** As a security engineer, I want access tokens to have a short expiry and token rotation to behave correctly, so that compromised tokens have a limited window of validity.

#### Acceptance Criteria

1. WHEN an access token is generated without an explicit expiry override, THE JWT Utility SHALL default to `"15m"` expiry.
2. WHEN a refresh token is found in the database but has simply expired (not revoked), THE JWT Utility SHALL return `null` without revoking all other sessions for that user.
3. WHEN a refresh token is found in the database and its `revoked` field is `true`, THE JWT Utility SHALL revoke all sessions for that user (token reuse attack response).

---

### Requirement 6: Authentication Controller Correctness

**User Story:** As a user, I want authentication flows to behave correctly and securely, so that my account is protected and OTP flows work as expected.

#### Acceptance Criteria

1. WHEN `verifySignupOtp` returns a user object, THE Auth Controller SHALL call `.toJSON()` on the Mongoose document before returning it, ensuring OTP fields are stripped.
2. WHEN `resendOtp` is called for a signup flow and the user's email is already verified, THE Auth Controller SHALL return a 400 error instead of sending a new OTP.
3. WHEN `resetPassword` is called, THE Auth Controller SHALL validate that the new password meets a minimum length of 8 characters before updating.
4. WHEN a Google login is processed and the Google profile returns no photo URL, THE Auth Controller SHALL NOT overwrite an existing `avatarUrl` with `null`.

---

### Requirement 7: User Controller Correctness

**User Story:** As a user, I want my profile data to be accurate and my avatar to be managed through the correct upload flow.

#### Acceptance Criteria

1. WHEN a user's age is calculated from their date of birth, THE User Controller SHALL use a month-and-day-aware calculation, not a year-only subtraction.
2. WHEN a user profile update is processed, THE User Controller SHALL NOT include `avatarUrl` in the list of directly settable fields, preventing bypass of the Cloudinary upload flow.
3. WHEN the user controller imports the Notification model, THE User Controller SHALL use the top-level import and SHALL NOT contain a redundant inner `require` call.

---

### Requirement 8: Health Controller Correctness

**User Story:** As a user, I want my health data, streaks, and analytics to be calculated correctly, so that the app reflects my actual activity.

#### Acceptance Criteria

1. WHEN `getWeeklySteps` is called with `from` and `to` query parameters, THE Health Controller SHALL validate that both values are valid ISO date strings and return a 400 error if they are not.
2. WHEN passive step coins are awarded and the step-goal coin block is evaluated on the same day, THE Health Controller SHALL use a separate `stepGoalCoinDate` field so that passive coins do not prevent step-goal coins from being awarded.
3. WHEN `_updateStreak` is called and no streak fields have changed, THE Health Controller SHALL NOT call `gam.save()`.
4. WHEN year analytics are grouped into quarters, THE Health Controller SHALL group by relative index within the 12-month window, not by absolute calendar month.
5. WHEN height is stored in a `BmiRecord`, THE Health Controller SHALL store the value in centimetres to match the `User` model's `height` field unit.

---

### Requirement 9: Challenge Controller Correctness

**User Story:** As a user, I want challenge progress to be calculated correctly and rewards to be credited reliably.

#### Acceptance Criteria

1. WHEN the week number is calculated for challenge grouping, THE Challenge Controller SHALL use an ISO week calculation to avoid producing week 53 or misaligned boundaries.
2. WHEN a weekly `MEALS_LOGGED` challenge progress is evaluated, THE Challenge Controller SHALL use `weeklyMealLogs.length` as the current value, not today's meal count.
3. WHEN a challenge reward is about to be marked as claimed, THE Challenge Controller SHALL save the gamification document first, then mark `isRewarded: true`, so that a save failure does not result in a permanently-claimed but uncredited reward.

---

### Requirement 10: Gamification Controller Correctness

**User Story:** As a user, I want my coin balance, leaderboard, and transaction history to be accurate and safe.

#### Acceptance Criteria

1. WHEN the leaderboard is built and a `Gamification` document references a deleted user, THE Gamification Controller SHALL skip that entry rather than crashing with a null-pointer error.
2. WHEN the coin transaction list is built, THE Gamification Controller SHALL NOT include step-goal coin entries from both `allActivities` and `claimHistory`; step-goal coins SHALL appear only in `claimHistory`.
3. WHEN `syncGamification` receives a `lastActiveDate` value from the client, THE Gamification Controller SHALL validate that it is a valid ISO date string and is not in the future.
4. WHEN `claimReward` awards coins for a streak badge, THE Gamification Controller SHALL apply the same daily coin cap (`remainingAllowance`) check used in `earnCoins`.

---

### Requirement 11: Shop Controller Correctness and Security

**User Story:** As a user, I want shop purchases to be atomic and my coin balance to be accurate, and as a security engineer I want the shop to be free of injection vulnerabilities.

#### Acceptance Criteria

1. WHEN `buyWithCoins` executes, THE Shop Controller SHALL wrap stock decrement, coin deduction, and order creation in a single MongoDB session/transaction so that a failure in any step rolls back all changes.
2. WHEN a coin deduction is applied, THE Shop Controller SHALL use `Math.round` to prevent floating-point drift in the coins balance.
3. WHEN a coin refund is applied on order cancellation, THE Shop Controller SHALL use `Math.round` to prevent floating-point drift in the coins balance.
4. WHEN a product search query is received, THE Shop Controller SHALL escape all regex special characters in the user-supplied search string before using it in a `$regex` query.
5. WHEN `getAvailableCoupons` fetches coupon data, THE Shop Controller SHALL retrieve all required fields in a single MongoDB query instead of two separate round-trips.

---

### Requirement 12: Shop Routes Security

**User Story:** As a security engineer, I want user PII to be protected on public endpoints.

#### Acceptance Criteria

1. WHEN `GET /shop/products/:id/reviews` is called without authentication, THE Shop Router SHALL either require authentication or strip user PII (name, avatarUrl) from the response.

---

### Requirement 13: Referral Controller Correctness

**User Story:** As a user, I want referral coins to be awarded reliably without the risk of double-crediting.

#### Acceptance Criteria

1. WHEN a referral is processed, THE Referral Controller SHALL create the `Referral` record before awarding coins, so that a failure during coin award does not allow a second coin award on retry.

---

### Requirement 14: Notification Controller

**User Story:** As a developer, I want notification errors to be visible in logs so that silent failures can be diagnosed.

#### Acceptance Criteria

1. WHEN `Notification.insertMany` fails, THE Notification Controller SHALL log the error instead of silently swallowing it.

---

### Requirement 15: User Model Correctness

**User Story:** As a developer, I want the User model to be consistent and safe for all authentication providers.

#### Acceptance Criteria

1. WHEN the `gender` field is validated, THE User Model SHALL NOT include `null` in the enum array, preventing inconsistent Mongoose validation behaviour.
2. WHEN `comparePassword` is called on an OAuth user who has no password set, THE User Model SHALL return `false` instead of throwing a `TypeError`.

---

### Requirement 16: Order Model Correctness

**User Story:** As a user, I want orders to always have a valid shipping address so that fulfilment is possible.

#### Acceptance Criteria

1. WHEN an order is created, THE Order Model SHALL require `street`, `city`, `state`, and `zipCode` fields in `shippingAddress`.

---

### Requirement 17: Config Controller

**User Story:** As a developer, I want FAQ seeding to handle partial failures gracefully.

#### Acceptance Criteria

1. WHEN FAQ seed data is inserted, THE Config Controller SHALL use `ordered: false` or per-document upserts so that a single duplicate does not abort the entire batch.

---

### Requirement 18: Frontend: App.tsx Fixes

**User Story:** As a developer, I want the React Native app root to be stable across Fast Refresh cycles and background events to be safe.

#### Acceptance Criteria

1. WHEN `notifee.onBackgroundEvent` fires in a background JS context, THE App SHALL wrap the Zustand store access in a try/catch to prevent crashes if MMKV is not yet initialised.
2. WHEN the app module is evaluated, THE QueryClient SHALL be created inside the `App` component (or via `useMemo`) so that it is recreated on Fast Refresh.
3. WHEN the hydration `useEffect` dependency array is specified, THE App SHALL stabilise the `checkAndResetIfNewDay` function with `useCallback` and remove the `eslint-disable-next-line` suppression.

---

### Requirement 19: Frontend: API Utility Fixes

**User Story:** As a developer, I want the API utility to use the correct base URL and handle token lifecycle safely.

#### Acceptance Criteria

1. WHEN the app is built, THE API Utility SHALL read `BASE_URL` from an environment variable with a fallback to `localhost`, not a hardcoded production URL.
2. WHEN a token refresh completes and the user has logged out during the refresh, THE API Utility SHALL check `isLoggingOut()` before saving the new tokens to prevent re-authenticating a logged-out user.
3. WHEN `tryRefresh` receives tokens from the server, THE API Utility SHALL validate that both `accessToken` and `refreshToken` are non-empty strings before saving them.

---

### Requirement 20: Frontend: Auth Store Fixes

**User Story:** As a developer, I want the auth store to persist tokens reliably and log out safely.

#### Acceptance Criteria

1. WHEN `setAuth` is called with new tokens, THE Auth Store SHALL `await` the `tokenService.save(tokens)` call to ensure tokens are persisted before the store state is updated.
2. WHEN `logout` performs dynamic imports to clear stores, THE Auth Store SHALL wrap each dynamic import in a try/catch to prevent an import failure from leaving the app in a broken state.

---

### Requirement 21: Frontend: Gamification Store Timezone Fix

**User Story:** As a user in a UTC+ timezone, I want streak calculations to use my local date, so that my streak is not broken by a UTC midnight that occurs before my local midnight.

#### Acceptance Criteria

1. WHEN the gamification store calculates today's date string for streak logic, THE Gamification Store SHALL use the local timezone date string, not the UTC ISO string.

---

### Requirement 22: Frontend: Cart Context Fix

**User Story:** As a user, I want my cart to be cleared after a successful purchase, so that I do not see stale items after checkout.

#### Acceptance Criteria

1. WHEN a purchase mutation succeeds, THE Cart Context SHALL call `clearCart()` in the `onSuccess` callback.
2. WHEN a `discountedPrice` value is typed in the cart, THE Cart Context SHALL use `number | null` consistently, matching the backend's representation.

---

### Requirement 23: Frontend: Notification Setup Hook Fix

**User Story:** As a developer, I want the initial notification handler to run only once per app lifecycle, not on every component mount.

#### Acceptance Criteria

1. WHEN `useNotificationSetup` is called on subsequent mounts within the same app lifecycle, THE Notification Setup Hook SHALL use a `useRef` flag to ensure `getInitialNotification` runs only once per cold start.

---
