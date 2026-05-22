# Implementation Plan: Bug Fixes

## Overview

52 bugs are fixed across the Athlofit backend (Node.js/Express) and React Native frontend. Tasks are ordered by severity and grouped by file/area so each task is a focused, self-contained change. Critical bugs come first, followed by high, medium, and low severity groups.

---

## Tasks

- [x] 1. Fix server entry point — create `server.js` (BUG-001)
  - Create `athlofit-backend/src/server.js` that imports `app.js`, calls `connectDB()`, then calls `app.listen(PORT)`
  - Verify `node src/index.js` starts without `MODULE_NOT_FOUND` error
  - _Requirements: 1.1, 1.2_

- [ ] 2. Fix `buyWithCoins` — wrap in MongoDB transaction (BUG-029)
  - Import `mongoose` in `shop.controller.js`
  - Wrap stock decrement, coin deduction, coupon update, and `Order.create` in a single `session.startTransaction()` / `session.commitTransaction()` block
  - Add `session.abortTransaction()` in the catch block and `session.endSession()` in finally
  - _Requirements: 11.1_

  - [ ]* 2.1 Write integration test for `buyWithCoins` atomicity
    - Simulate `Order.create` failure and verify stock and coins are rolled back
    - _Requirements: 11.1_

- [ ] 3. Fix coin arithmetic — apply `Math.round` to deductions and refunds (BUG-030, BUG-031)
  - In `buyWithCoins`: `gamification.coinsBalance = Math.round(gamification.coinsBalance - finalCoinCost)`
  - In `cancelOrder`: `gam.coinsBalance = Math.round(gam.coinsBalance + order.totalCoins)`
  - _Requirements: 11.2, 11.3_

  - [ ]* 3.1 Write property test for coin balance integer invariant
    - **Property 9: Coin balance arithmetic is always integer-valued**
    - **Validates: Requirements 11.2, 11.3**

- [ ] 4. Fix ReDoS vulnerability — escape regex in product search (BUG-032)
  - Add `escapeRegex` helper in `shop.controller.js`
  - Apply it to the `search` query param before constructing `$regex` filters in `getProducts` and `searchProducts`
  - _Requirements: 11.4_

  - [ ]* 4.1 Write property test for regex escaping
    - **Property 10: Regex-escaped search strings contain no unescaped special characters**
    - **Validates: Requirements 11.4**

- [x] 5. Fix credential leak — remove MONGO_URI log (BUG-004)
  - Delete the `console.log("process.env.MONGO_URI", process.env.MONGO_URI)` line from `config/db.js`
  - _Requirements: 3.1_

- [ ] 6. Fix OTP security — use CSPRNG and reuse email transport (BUG-005, BUG-006)
  - Replace `Math.floor(100000 + Math.random() * 900000)` with `crypto.randomInt(100000, 1000000)` in `utils/otp.js`
  - Move `nodemailer.createTransport(...)` call to module level; remove `createTransport()` helper function
  - _Requirements: 4.1, 4.2_

  - [ ]* 6.1 Write property test for OTP format
    - **Property 1: OTP is always a 6-digit numeric string**
    - **Validates: Requirements 4.1**

- [x] 7. Fix JWT access token expiry (BUG-007)
  - Change default expiry in `generateAccessToken` from `"30d"` to `"15m"` in `utils/jwt.js`
  - _Requirements: 5.1_

- [x] 8. Fix JWT token rotation — separate expired vs revoked handling (BUG-008)
  - In `rotateRefreshToken` in `utils/jwt.js`, split the `!stored || stored.expiresAt < now` condition into three separate cases: not found (return null), expired but not revoked (return null without revoking), revoked (revoke all sessions)
  - _Requirements: 5.2, 5.3_

- [x] 9. Fix step-goal coins blocked by passive coins — add `stepGoalCoinDate` field (BUG-017)
  - Add `stepGoalCoinDate: { type: String, default: null }` to the `Gamification` model
  - In `health.controller.js`, replace the step-goal coin check from `gam.lastCoinDate !== today` to `gam.stepGoalCoinDate !== today`
  - Set `gam.stepGoalCoinDate = today` when step-goal coins are awarded
  - _Requirements: 8.2_

- [x] 10. Fix weekly `MEALS_LOGGED` challenge count (BUG-022)
  - In `challenge.controller.js`, change `currentValue = mealsLoggedCount` to `currentValue = weeklyMealLogs.length` for the `MEALS_LOGGED` challenge type
  - _Requirements: 9.2_

- [x] 11. Fix challenge reward save order — save gam before marking isRewarded (BUG-023)
  - In `challenge.controller.js`, reorder so `await gam.save()` is called before `challenge.isRewarded = true` and `await challenge.save()`
  - _Requirements: 9.3_

- [ ] 12. Fix leaderboard null-user crash (BUG-026)
  - In `gamification.controller.js` `getLeaderboard`, add `.filter(g => g.user != null)` before the `.map(...)` call
  - _Requirements: 10.1_

  - [ ]* 12.1 Write property test for leaderboard null safety
    - **Property 7: Leaderboard never contains null user entries**
    - **Validates: Requirements 10.1**

- [x] 13. Fix `verifySignupOtp` — return `user.toJSON()` (BUG-010)
  - In `auth.controller.js` `verifySignupOtp`, call `user.toJSON()` before returning the user object to ensure OTP fields are stripped by the schema transform
  - _Requirements: 6.1_

- [x] 14. Fix `resendOtp` — guard against already-verified users (BUG-011)
  - In `auth.controller.js` `resendOtp`, add a check: if `flow === 'signup'` and `user.emailVerified`, return a 400 error
  - _Requirements: 6.2_

- [ ] 15. Fix `resetPassword` — add server-side password length validation (BUG-012)
  - In `auth.controller.js` `resetPassword`, validate `newPassword.length >= 8` before updating; return 400 if not met
  - _Requirements: 6.3_

  - [ ]* 15.1 Write property test for password length validation
    - **Property 2: Password reset rejects short passwords**
    - **Validates: Requirements 6.3**

- [x] 16. Fix Google login — do not overwrite avatarUrl with null (BUG-013)
  - In `auth.controller.js` Google login handler, only assign `user.avatarUrl = googleUser.photo` when `googleUser.photo` is truthy
  - _Requirements: 6.4_

- [x] 17. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Fix rate limiting — exclude `/auth` from global limiter (BUG-002)
  - In `app.js`, replace `app.use(limiter)` with a conditional middleware that skips `/auth` paths
  - _Requirements: 2.1_

- [ ] 19. Fix CORS — throw on missing `CLIENT_URL` in production (BUG-003)
  - In `app.js`, add a startup guard that throws if `NODE_ENV === 'production'` and `CLIENT_URL` is not set
  - _Requirements: 2.2, 3.2_

- [ ] 20. Fix notification cap race condition (BUG-009)
  - In `utils/createNotification.js`, replace the count→find→delete sequence with a MongoDB session/transaction or an atomic `$push` with `$slice` to maintain the notification cap
  - _Requirements: (supporting fix — no direct requirement number, supports overall data integrity)_

- [ ] 21. Fix age calculation — month/day-aware (BUG-014)
  - In `user.controller.js`, replace the year-only age subtraction with a full month-and-day-aware calculation
  - _Requirements: 7.1_

  - [ ]* 21.1 Write property test for age calculation correctness
    - **Property 3: Age calculation is always correct to the day**
    - **Validates: Requirements 7.1**

- [ ] 22. Fix user profile update — remove `avatarUrl` from allowed fields (BUG-016)
  - In `user.controller.js`, remove `avatarUrl` from the `allowedFields` array in the profile update handler
  - _Requirements: 7.2_

- [ ] 23. Fix redundant Notification model require (BUG-015)
  - In `user.controller.js`, remove the inner `require('../models/Notification.model')` call; the model is already imported at the top of the file
  - _Requirements: 7.3_

- [ ] 24. Fix `getWeeklySteps` — validate ISO date params (BUG-021)
  - In `health.controller.js` `getWeeklySteps`, add ISO date format validation for `from` and `to` query params; return 400 if invalid
  - _Requirements: 8.1_

  - [ ]* 24.1 Write property test for date validation
    - **Property 4: Date validation rejects non-ISO strings**
    - **Validates: Requirements 8.1**

- [ ] 25. Fix `_updateStreak` — only save when dirty (BUG-018)
  - In `health.controller.js` `_updateStreak`, introduce a `dirty` flag; only call `gam.save()` when at least one field has changed
  - _Requirements: 8.3_

- [ ] 26. Fix year analytics quarterly grouping (BUG-019)
  - In `health.controller.js`, replace absolute calendar month grouping with relative index grouping: `quarter = Math.floor(relativeIndex / 3)`
  - _Requirements: 8.4_

  - [ ]* 26.1 Write property test for quarterly grouping
    - **Property 5: Year analytics always produces exactly 4 quarters**
    - **Validates: Requirements 8.4**

- [ ] 27. Fix height unit inconsistency — standardise on cm in BmiRecord (BUG-020)
  - In `health.controller.js`, ensure height is passed in cm (not metres) when creating a `BmiRecord`; add a comment clarifying the unit
  - _Requirements: 8.5_

- [ ] 28. Fix ISO week calculation in challenge controller (BUG-024)
  - In `challenge.controller.js`, replace the non-standard week number calculation with a correct ISO 8601 week calculation function
  - _Requirements: 9.1_

  - [ ]* 28.1 Write property test for ISO week number
    - **Property 6: ISO week number is always between 1 and 53**
    - **Validates: Requirements 9.1**

- [ ] 29. Fix `claimReward` — apply daily coin cap for streak badges (BUG-025)
  - In `gamification.controller.js` `claimReward`, load `MAX_DAILY_COINS` from config and apply the `remainingAllowance` cap before awarding streak badge coins
  - _Requirements: 10.4_

- [ ] 30. Fix duplicate step-goal coins in transaction list (BUG-027)
  - In `gamification.controller.js` `getCoinData`, remove `allActivities` from the `allTransactions` merge; step-goal coins are already represented in `claimHistory`
  - _Requirements: 10.2_

- [ ] 31. Fix `syncGamification` — validate `lastActiveDate` (BUG-028)
  - In `gamification.controller.js` `syncGamification`, validate that `lastActiveDate` is a valid ISO date string and is not in the future; return 400 if invalid
  - _Requirements: 10.3_

  - [ ]* 31.1 Write property test for lastActiveDate validation
    - **Property 8: lastActiveDate sync rejects future dates**
    - **Validates: Requirements 10.3**

- [ ] 32. Fix `getAvailableCoupons` — single query (BUG-033)
  - In `shop.controller.js` `getAvailableCoupons`, replace the two-query pattern with a single query that includes `usedBy` and `perUserLimit`, then filter in memory
  - _Requirements: 11.5_

- [ ] 33. Fix `GET /products/:id/reviews` — require auth or strip PII (BUG-040)
  - In `routes/shop.routes.js`, add the `authenticate` middleware to the `GET /products/:id/reviews` route, or strip `user.name` and `user.avatarUrl` from the response in the controller
  - _Requirements: 12.1_

- [ ] 34. Fix referral coin award order (BUG-034)
  - In `referral.controller.js`, move all coin award logic to after `await Referral.create(...)` succeeds
  - _Requirements: 13.1_

- [ ] 35. Fix silent notification error (BUG-035)
  - In `notification.controller.js`, replace `.catch(() => {})` on `Notification.insertMany` with `.catch((err) => console.error('[Notification] insertMany failed:', err))`
  - _Requirements: 14.1_

- [ ] 36. Fix FAQ seed partial failure handling (BUG-036)
  - In `config.controller.js`, add `{ ordered: false }` to the `Faq.insertMany` call so a single duplicate does not abort the entire batch
  - _Requirements: 17.1_

- [ ] 37. Fix User model — remove null from gender enum (BUG-037)
  - In `models/User.model.js`, remove `null` from the `gender` enum array; keep `default: null`
  - _Requirements: 15.1_

- [ ] 38. Fix `comparePassword` — guard for OAuth users (BUG-038)
  - In `models/User.model.js` `comparePassword`, add `if (!this.password) return false;` before the `bcrypt.compare` call
  - _Requirements: 15.2_

- [ ] 39. Fix Order model — require shipping address fields (BUG-039)
  - In `models/Order.model.js`, add `required: true` to `street`, `city`, `state`, and `zipCode` in the `shippingAddress` sub-schema
  - _Requirements: 16.1_

  - [ ]* 39.1 Write property test for Order address validation
    - **Property 11: Order creation fails for missing required address fields**
    - **Validates: Requirements 16.1**

- [ ] 40. Checkpoint — ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 41. Fix `notifee.onBackgroundEvent` — wrap in try/catch (BUG-041)
  - In `src/app/App.tsx`, wrap the body of the `onBackgroundEvent` handler in a try/catch block
  - _Requirements: 18.1_

- [ ] 42. Fix `QueryClient` — move inside `App` component (BUG-042)
  - In `src/app/App.tsx`, move the `QueryClient` instantiation inside the `App` component using `React.useState(() => new QueryClient(...))`
  - _Requirements: 18.2_

- [ ] 43. Fix hydration `useEffect` — stabilise with `useCallback` (BUG-043)
  - In `src/app/App.tsx`, wrap `checkAndResetIfNewDay` selector with `useCallback`, add it to the `useEffect` dependency array, and remove the `eslint-disable-next-line` comment
  - _Requirements: 18.3_

- [ ] 44. Fix `BASE_URL` — use environment variable (BUG-044)
  - In `src/utils/api.ts`, replace the hardcoded production URL with `process.env.REACT_APP_API_URL` with a platform-aware localhost fallback
  - _Requirements: 19.1_

- [ ] 45. Fix token refresh mutex — check `isLoggingOut` after refresh (BUG-045)
  - In `src/utils/api.ts`, after `await refreshPromise` resolves, check `isLoggingOut()` before proceeding with the retry; if logging out, throw the session-expired error instead
  - _Requirements: 19.2_

- [ ] 46. Fix `tryRefresh` — validate tokens before saving (BUG-046)
  - In `src/utils/api.ts` `tryRefresh`, add a guard: if `newAccessToken` or `newRefreshToken` is falsy, return `false` without calling `tokenService.save`
  - _Requirements: 19.3_

  - [ ]* 46.1 Write property test for tryRefresh token validation
    - **Property 12: tryRefresh returns false for empty/null tokens**
    - **Validates: Requirements 19.3**

- [ ] 47. Fix `setAuth` — await token save (BUG-047)
  - In `src/features/auth/store/authStore.ts`, make `setAuth` async and add `await` before `tokenService.save(tokens)`
  - _Requirements: 20.1_

- [ ] 48. Fix `logout` — wrap dynamic imports in try/catch (BUG-048)
  - In `src/features/auth/store/authStore.ts` `logout`, wrap each dynamic import (`gamificationStore`, `hydrationStore`, `healthDataStore`) in its own try/catch block
  - _Requirements: 20.2_

- [ ] 49. Fix gamification store — use local timezone date (BUG-049)
  - In `src/features/health/store/gamificationStore.ts`, add a `getLocalDateString()` helper that uses `new Date()` local methods (`getFullYear`, `getMonth`, `getDate`)
  - Replace all `new Date().toISOString().slice(0, 10)` calls in the store with `getLocalDateString()`
  - _Requirements: 21.1_

  - [ ]* 49.1 Write property test for local date string
    - **Property 13: Local date string matches device timezone**
    - **Validates: Requirements 21.1**

- [ ] 50. Fix cart — clear after successful purchase (BUG-050)
  - In `src/features/shop/context/CartContext.tsx` (or the screen/hook that calls the purchase mutation), call `clearCart()` in the `onSuccess` callback
  - _Requirements: 22.1_

- [ ] 51. Fix `discountedPrice` type inconsistency (BUG-051)
  - In the `Product` type definition (in `src/features/shop/types/shop.types.ts` or equivalent), change `discountedPrice` to `number | null` (not `number | undefined`)
  - _Requirements: 22.2_

- [ ] 52. Fix `getInitialNotification` — run only once per app lifecycle (BUG-052)
  - In `src/hooks/useNotificationSetup.ts`, add a `useRef<boolean>` flag initialised to `false`; set it to `true` on first execution and return early on subsequent mounts
  - _Requirements: 23.1_

- [ ] 53. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster fix pass
- Each task references specific requirements for traceability
- Critical bugs (BUG-001, BUG-029) are in tasks 1–2 and should be fixed first
- Security bugs (BUG-004, BUG-005, BUG-007, BUG-032, BUG-040) are in tasks 3–7 and 33
- Property tests validate universal correctness properties defined in `design.md`
- Unit tests validate specific examples and edge cases

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16]
    },
    {
      "wave": 2,
      "tasks": [8, 17]
    },
    {
      "wave": 3,
      "tasks": [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39]
    },
    {
      "wave": 4,
      "tasks": [40]
    },
    {
      "wave": 5,
      "tasks": [41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52]
    },
    {
      "wave": 6,
      "tasks": [53]
    }
  ]
}
```
