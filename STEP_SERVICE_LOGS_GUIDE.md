# Step Counter Service - Log Messages Guide

This document explains all log messages from the Step Counter Service and what they mean.

---

## 📡 SENSOR REGISTRATION LOGS

### ✅ SENSOR_SUCCESS: Sensor registered successfully
```
════════════════════════════════════════════════════════════════
✅ SENSOR_SUCCESS: Sensor registered successfully
════════════════════════════════════════════════════════════════
Sensor: [sensor name]
Status: Listening for step events
Mode: Native sensor (real-time updates)
════════════════════════════════════════════════════════════════
```
**Meaning**: Native step counter sensor is working properly
**Action**: None - everything is normal
**Expected**: This should appear on every fresh app start

---

### ❌ SENSOR_FAIL: SensorManager unavailable
```
════════════════════════════════════════════════════════════════
❌ SENSOR_FAIL: SensorManager unavailable
════════════════════════════════════════════════════════════════
Reason: SensorManager system service returned null
Impact: Native sensor cannot be used - falling back to Health Connect
Possible causes:
  • System service not initialized yet (rare)
  • Device doesn't support sensor framework (very rare)
Action: Will retry every 60 seconds
════════════════════════════════════════════════════════════════
```
**Meaning**: Android sensor system is not available (very rare)
**Fix**: 
1. Restart device
2. If persists, device may have hardware/firmware issue
**Impact**: App will use Health Connect only

---

### ❌ SENSOR_FAIL: Step counter sensor not available
```
════════════════════════════════════════════════════════════════
❌ SENSOR_FAIL: Step counter sensor not available
════════════════════════════════════════════════════════════════
Sensor type: TYPE_STEP_COUNTER
Reason: Device doesn't have step counter hardware sensor
Impact: Native sensor cannot be used - falling back to Health Connect
Note: This is expected on devices without step counter hardware
Action: Will use Health Connect as primary data source
════════════════════════════════════════════════════════════════
```
**Meaning**: Device doesn't have step counter hardware
**Fix**: None - device limitation
**Impact**: App will use Health Connect only (still works!)

---

### ❌ SENSOR_FAIL: registerListener returned false
```
════════════════════════════════════════════════════════════════
❌ SENSOR_FAIL: registerListener returned false
════════════════════════════════════════════════════════════════
Sensor: [sensor name] ([vendor])
Reason: One of the following:
  • Sensor is busy/in use by another app
  • App doesn't have ACTIVITY_RECOGNITION permission
  • Sensor temporarily unavailable (battery optimization)
  • OEM restriction on sensor access
Impact: Native sensor cannot be used - falling back to Health Connect
Action: Will retry every 60 seconds
Fix: 
  1. Grant ACTIVITY_RECOGNITION permission in Settings
  2. Disable battery optimization for Athlofit
  3. Restart device if sensor is stuck
════════════════════════════════════════════════════════════════
```
**Meaning**: Sensor exists but registration failed
**Fix**: 
1. **Settings → Apps → Athlofit → Permissions** → Grant "Physical activity"
2. **Settings → Apps → Athlofit → Battery** → Unrestricted
3. Restart device
**Impact**: Will auto-retry every 60s and recover when issue resolved

---

## 🔄 SENSOR RETRY LOGS

### 🔄 SENSOR_RETRY: Attempting sensor re-registration
```
════════════════════════════════════════════════════════════════
🔄 SENSOR_RETRY: Attempting sensor re-registration
════════════════════════════════════════════════════════════════
Time since service start: [X]s
Current mode: Health Connect only (native sensor unavailable)
Retry attempt: Every 60 seconds
Reason: Sensor may have become available after:
  • Battery optimization disabled
  • Doze mode ended
  • Permission granted
  • Device unlocked
════════════════════════════════════════════════════════════════
```
**Meaning**: Service is trying to recover native sensor
**Action**: None - automatic recovery in progress

---

### ✅ SENSOR_RETRY_SUCCESS: Sensor now available!
```
════════════════════════════════════════════════════════════════
✅ SENSOR_RETRY_SUCCESS: Sensor now available!
════════════════════════════════════════════════════════════════
Time to recovery: [X]s
Previous mode: Health Connect only
New mode: Native sensor (real-time updates)
Action: Stopping Health Connect polling, using native sensor
════════════════════════════════════════════════════════════════
```
**Meaning**: Sensor recovered successfully! Now using native sensor
**Action**: None - automatic recovery succeeded

---

### ⚠️ SENSOR_RETRY_FAIL: Sensor still unavailable
```
════════════════════════════════════════════════════════════════
⚠️ SENSOR_RETRY_FAIL: Sensor still unavailable
════════════════════════════════════════════════════════════════
Time elapsed: [X]s
Current mode: Still on Health Connect only
Next retry: In 60 seconds
Reason: See SENSOR_FAIL logs above for specific reason
════════════════════════════════════════════════════════════════
```
**Meaning**: Retry attempt failed, will try again
**Action**: Check earlier SENSOR_FAIL log for root cause

---

## 🌙 MIDNIGHT RESET LOGS

### 🌙 MIDNIGHT_RESET: Starting midnight reset
```
════════════════════════════════════════════════════════════════
🌙 MIDNIGHT_RESET: Starting midnight reset
════════════════════════════════════════════════════════════════
Previous date: [YYYY-MM-DD]
New date: [YYYY-MM-DD]
Steps yesterday: [X]
Previous baseline: [X]
Previous rebootOffset: [X]
Previous displayStepFloor: [X]
lastCumulative sensor value: [X]
════════════════════════════════════════════════════════════════
```
**Meaning**: Midnight reset triggered - steps resetting to 0
**Action**: None - normal daily reset

---

### ✅ MIDNIGHT_RESET: Reset complete
```
════════════════════════════════════════════════════════════════
✅ MIDNIGHT_RESET: Reset complete
════════════════════════════════════════════════════════════════
New date: [YYYY-MM-DD]
New baseline: [X]
Daily steps: 0
Reboot offset: 0
Display floor: 0
Live step count: 0
JS gate active: Next 120 seconds (blocks JS updates > 50 steps)
Notification: Updated to 0
Widget: Updated to 0
JS event: Emitted (steps=0)
════════════════════════════════════════════════════════════════
```
**Meaning**: Midnight reset completed successfully
**What to expect**: 
- Notification shows 0
- App shows 0
- JS gate blocks stale data for 2 minutes
**Action**: None - everything reset properly

---

## 🛑 PUSH UPDATE REJECTION LOGS

### ❌ PUSH_REJECTED: Out of range value
```
════════════════════════════════════════════════════════════════
❌ PUSH_REJECTED: Out of range value
════════════════════════════════════════════════════════════════
Steps received: [X]
Valid range: 0 to [MAX]
Reason: Value is negative or impossibly high
Action: Rejected - notification/widget not updated
════════════════════════════════════════════════════════════════
```
**Meaning**: JS tried to push invalid step count
**Causes**: 
- Bug in Health Connect data
- Corrupted server data
- Math overflow in JS
**Impact**: Bad data rejected, notification/widget not updated

---

### 🛑 PUSH_REJECTED: Midnight reset gate active
```
════════════════════════════════════════════════════════════════
🛑 PUSH_REJECTED: Midnight reset gate active
════════════════════════════════════════════════════════════════
Steps received from JS: [X]
Time since midnight reset: [X]s
Gate duration: 120s (2 minutes)
Current liveStepCount: [X]
Reason: Preventing stale cached data from overwriting 0 steps
Action: Rejected - wait for native sensor to confirm reset
Note: Gate opens when native sensor reports ≤50 steps OR after 120s
════════════════════════════════════════════════════════════════
```
**Meaning**: JS tried to push yesterday's cached steps after midnight
**Why rejected**: Protects notification/widget from showing wrong data
**When it opens**: 
1. Native sensor reports ≤50 steps (confirms reset), OR
2. 120 seconds elapsed
**Action**: None - this is protecting data integrity!

---

## 🏥 HEALTH CONNECT LOGS

### ❌ HC_PERMISSION_DENIED: Cannot read Health Connect data
```
════════════════════════════════════════════════════════════════
❌ HC_PERMISSION_DENIED: Cannot read Health Connect data
════════════════════════════════════════════════════════════════
Error: [error message]
Reason: Health Connect read permission not granted
Impact: Cannot read steps from Health Connect fallback
Action Required:
  1. Open Health Connect app
  2. Go to "App permissions" → "Athlofit"
  3. Enable "Steps" read permission
Current mode: [Native sensor only OR NO DATA SOURCE]
════════════════════════════════════════════════════════════════
```
**Meaning**: Health Connect permission not granted
**Fix**: 
1. Open **Health Connect** app
2. **App permissions** → **Athlofit**
3. Enable **"Steps"** read permission
**Impact**: 
- If native sensor works: No impact
- If native sensor fails: NO STEPS COUNTED

---

### ⚠️ HC_POLL_ERROR: Health Connect read failed
```
════════════════════════════════════════════════════════════════
⚠️ HC_POLL_ERROR: Health Connect read failed
════════════════════════════════════════════════════════════════
Error: [error message]
Error type: [exception type]
Reason: Health Connect temporarily unavailable or data access error
Action: Using cached widget value if available
Next poll: In [X]s
════════════════════════════════════════════════════════════════
```
**Meaning**: Health Connect read failed (temporary issue)
**Action**: Wait - will auto-retry
**Impact**: Using last known value until HC available again

---

## ⚡ SENSOR ACCURACY LOGS

### ⚠️ SENSOR_ACCURACY: Unreliable
```
════════════════════════════════════════════════════════════════
⚠️ SENSOR_ACCURACY: Unreliable
════════════════════════════════════════════════════════════════
Sensor: [sensor name]
Accuracy: UNRELIABLE
Reason: Sensor readings may be inaccurate
Impact: Steps may not be counted accurately
Action: Will attempt recovery on next watchdog cycle (10s)
Possible causes:
  • Sensor calibration needed
  • Hardware issue
  • Environmental interference
════════════════════════════════════════════════════════════════
```
**Meaning**: Sensor accuracy degraded
**Fix**: 
1. Calibrate sensor (walk a few steps)
2. Restart device
**Impact**: Steps may be slightly inaccurate

---

### ❌ SENSOR_ACCURACY: No contact
```
════════════════════════════════════════════════════════════════
❌ SENSOR_ACCURACY: No contact
════════════════════════════════════════════════════════════════
Sensor: [sensor name]
Accuracy: NO_CONTACT
Reason: Sensor has completely lost connection
Impact: Steps are NOT being counted
Action: Attempting immediate re-registration
Possible causes:
  • Sensor hub crashed/restarted
  • Battery optimization killed sensor
  • Hardware failure
════════════════════════════════════════════════════════════════
```
**Meaning**: Sensor completely disconnected
**Fix**: 
1. Disable battery optimization
2. Restart device
**Impact**: Steps NOT counted until recovered

---

## 📋 HOW TO COPY LOGS

### Method 1: From Logcat (Android Studio / ADB)
```bash
# Filter by StepCounterService
adb logcat | grep StepCounterService

# Save to file
adb logcat -d | grep StepCounterService > step_service_logs.txt
```

### Method 2: From Device Log Viewer Apps
1. Install **"aLogcat"** or **"Logcat Reader"** from Play Store
2. Open app
3. Filter: **StepCounterService**
4. Long press logs → **Copy** or **Share**

### Method 3: From Athlofit Debug Screen
1. Open Athlofit
2. Go to **Profile** → **Step Sources** 
3. Scroll to **"Native Service Log"**
4. Tap **"Copy Log"** button

---

## 🔍 TROUBLESHOOTING GUIDE

### Issue: "Steps not counting"

**Check these logs in order:**

1. **Look for SENSOR_SUCCESS**
   - ✅ Found → Sensor working
   - ❌ Not found → Check SENSOR_FAIL reason

2. **If SENSOR_FAIL appears:**
   - Check reason in the log
   - Apply fix from log's "Fix:" section
   - Look for SENSOR_RETRY logs

3. **If HC_PERMISSION_DENIED appears:**
   - Grant Health Connect permission
   - Steps should start counting

---

### Issue: "Notification shows wrong steps at midnight"

**Check these logs:**

1. **MIDNIGHT_RESET logs**
   - Should appear at 12:00 AM
   - Check "Reset complete" message

2. **PUSH_REJECTED logs after midnight**
   - This is GOOD - protecting data
   - Should stop after 120 seconds

---

### Issue: "Steps stuck/frozen"

**Check these logs:**

1. **SENSOR_ACCURACY logs**
   - UNRELIABLE → Wait for recovery
   - NO_CONTACT → Restart device

2. **Look for recent sensor events**
   - If no events for >5 minutes → sensor dead
   - Check SENSOR_RETRY logs

---

## 📞 SUPPORT

When reporting issues, **always include**:
1. Copy full log output (all lines between ════ borders)
2. Time when issue occurred
3. What you were doing (walking, app opened, etc.)
4. Device model and Android version

**Logs are designed to be copy-paste friendly!**
Each error includes:
- ✅ Clear error description
- ✅ Root cause explanation
- ✅ Step-by-step fix instructions
- ✅ Impact assessment
