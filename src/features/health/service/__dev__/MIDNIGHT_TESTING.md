# Midnight Reset Testing Guide (Emulator)

Emulator pe midnight step crossover test karne ke liye ye guide follow karo.
Raat ke 12 baje ka wait karne ki zaroorat nahi — emulator pe time change + root access dono available hai.

---

## Setup: Emulator Prepare Karo

### Step 1: Emulator Start (with writable system)
```bash
# API 34 emulator recommended (Health Connect built-in hai)
emulator -avd Pixel_7_API_34 -writable-system

# Ya Android Studio se: Tools > Device Manager > Start
```

### Step 2: Health Connect Setup (Emulator mein)
```bash
# Health Connect emulator pe pre-installed hota hai API 34+
# Verify karo:
adb shell pm list packages | grep healthconnect
# Output: package:com.google.android.apps.healthdata
```

### Step 3: App Install
```bash
cd android && ./gradlew installDebug
# Ya React Native se:
npx react-native run-android
```

---

## Method 1: Emulator Time Change via ADB (RECOMMENDED — Sabse Reliable)

Emulator pe root access hai, toh directly system time change kar sakte ho:

```bash
# Step 1: Automatic time sync OFF karo
adb shell settings put global auto_time 0

# Step 2: Current steps note karo
adb shell run-as com.athlofit.athlofit cat /data/data/com.athlofit.athlofit/shared_prefs/StepCounterPrefs.xml

# Step 3: Time set karo 11:58 PM aaj ka
adb shell date "07172326.00"  
# Format: MMDDhhmm.ss → July 17, 23:26 (example)
# Ya specific date ke liye: 
adb shell date "07172358.00"  # 11:58 PM

# Step 4: Wait 3 minutes (ya seedhe 12:02 AM set karo)
adb shell date "07180002.00"  # July 18, 00:02 AM (next day)

# Step 5: Check — steps should be 0
adb shell run-as com.athlofit.athlofit cat /data/data/com.athlofit.athlofit/shared_prefs/StepCounterPrefs.xml

# Step 6: After testing — time wapas correct karo
adb shell settings put global auto_time 1
```

### Important Notes:
- Emulator pe `adb shell date` **WORKS** (real device pe root chahiye)
- AlarmManager emulator pe correctly fire hota hai time change pe
- Health Connect bhi system time follow karta hai

---

## Method 2: Emulator Extended Controls (GUI Method)

1. Emulator window mein **"..." button** click karo (Extended Controls)
2. Nahi milega directly time option, toh **Settings app** open karo emulator mein:
   - Settings > System > Date & Time
   - "Set time automatically" OFF
   - Manually time set karo 11:58 PM
   - Phir 12:02 AM set karo
3. App check karo — steps 0 hone chahiye

---

## Method 3: ADB Commands (Native Service Direct Testing)

### Prerequisites:
```bash
# Emulator running hai toh automatically connected hoga
adb devices  # check connection — "emulator-5554" dikhna chahiye
```

### 3a. Force Midnight Reset Broadcast

```bash
# MidnightResetReceiver ko directly trigger karo (bina time change ke)
adb shell am broadcast \
  -n com.athlofit.athlofit/.MidnightResetReceiver
```

### 3b. SharedPreferences Read (Current State Check)

```bash
# StepCounterPrefs read karo — storedDate aur dailySteps dekho
adb shell run-as com.athlofit.athlofit cat /data/data/com.athlofit.athlofit/shared_prefs/StepCounterPrefs.xml
```

Output mein dekho:
```xml
<string name="storedDate">2026-07-17</string>
<int name="dailySteps" value="5000" />
<int name="rebootOffset" value="0" />
```

### 3c. Force storedDate to Yesterday (Simulate Missed Reset)

```bash
# Step 1: App kill karo
adb shell am force-stop com.athlofit.athlofit

# Step 2: storedDate ko yesterday set karo
adb shell run-as com.athlofit.athlofit sh -c "sed -i 's/storedDate\">[^<]*/storedDate\">2026-07-16/' /data/data/com.athlofit.athlofit/shared_prefs/StepCounterPrefs.xml"

# Step 3: App open karo — handleDateChangeOnStart() trigger hoga
adb shell am start -n com.athlofit.athlofit/.MainActivity

# Step 4: Logs check karo
adb logcat -s StepCounterService:D | grep "handleDateChangeOnStart"
```

### 3d. Monitor Logs (Real-time)

```bash
# Terminal 1: Step-related logs filter
adb logcat -s StepCounterService:D MidnightResetReceiver:D HealthSyncHelper:D NativeStepModule:D

# Terminal 2: Trigger midnight reset
adb shell am broadcast -n com.athlofit.athlofit/.MidnightResetReceiver
```

### 3e. Simulate Fake Steps in Health Connect (Emulator Only)

```bash
# Emulator pe Health Connect mein fake step data inject karo
# Health Connect Toolbox app use karo (Google ka official testing tool):
# https://developer.android.com/health-and-fitness/guides/health-connect/test

# Ya programmatically (app ke andar):
# Ye midnightSimulator.ts se call karo
```

---

## Method 4: JS Layer Testing (React Native Debugger)

### In Flipper / Chrome Debugger Console:

```javascript
// Import the simulator
const { MidnightSimulator } = require('./src/features/health/service/__dev__/midnightSimulator');

// Quick check — koi stale data risk hai?
await MidnightSimulator.quickCheck();

// Full midnight reset simulate karo
await MidnightSimulator.simulateMidnightReset();

// Post-midnight 5-min window test
await MidnightSimulator.simulatePostMidnightWindow();

// OEM alarm delay simulate karo (10 min late)
await MidnightSimulator.simulateOEMAlarmDelay(10);

// Full diagnostic report
await MidnightSimulator.runDiagnostic();
```

### Manual Scenario Setup:

```javascript
const { MidnightSimulator } = require('./src/features/health/service/__dev__/midnightSimulator');

// Step 1: Set steps to 8000 (pretend yesterday's steps)
MidnightSimulator.setStepsForTesting(8000);

// Step 2: Set lastFetchedAt to yesterday
MidnightSimulator.setLastFetchedToYesterday();

// Step 3: Now simulate midnight reset
await MidnightSimulator.simulateMidnightReset();

// Step 4: If steps are still 8000 after reset → BUG!
```

---

## Method 5: Widget/Notification Check via ADB

```bash
# Widget prefs check (steps shown on home screen widget)
adb shell run-as com.athlofit.athlofit cat /data/data/com.athlofit.athlofit/shared_prefs/StepsWidgetPrefs.xml

# After midnight reset, widget should show 0 steps
# If widget still shows yesterday's count → widget reset logic has a bug
```

---

## What to Look For (Pass/Fail Criteria)

| Test | PASS | FAIL |
|------|------|------|
| Midnight reset | Steps → 0 | Yesterday's steps persist |
| storedDate change | storedDate = today | storedDate = yesterday |
| Widget reset | Widget shows 0 | Widget shows old count |
| Notification reset | Notification shows 0 | Shows old count |
| Background sync skip | No sync during reset | Syncs stale data |
| HC read after reset | Returns today's steps only | Returns yesterday + today |

---

## Common Issues & Debug Tips

### Issue: Steps don't reset on Xiaomi/Oppo/Vivo
```bash
# Check if alarm was fired
adb logcat -s AlarmManager:D | grep athlofit

# Check battery optimization status
adb shell dumpsys deviceidle whitelist | grep athlofit
# Should show: +com.athlofit.athlofit (user whitelist)
```

### Issue: Steps double after reset (yesterday + today)
```bash
# Check Health Connect records
adb logcat -s HealthSyncHelper:D | grep "Steps by origin"
# Look for records with startTime before today's midnight
```

### Issue: Widget shows wrong count after midnight
```bash
# Force widget update
adb shell am broadcast -n com.athlofit.athlofit/.WidgetAlarmReceiver
# Then check widget prefs
adb shell run-as com.athlofit.athlofit cat /data/data/com.athlofit.athlofit/shared_prefs/StepsWidgetPrefs.xml
```

---

## Quick Test Workflow (2 minute test)

```bash
# 1. Note current steps
adb shell run-as com.athlofit.athlofit cat /data/data/com.athlofit.athlofit/shared_prefs/StepCounterPrefs.xml

# 2. Trigger midnight reset
adb shell am broadcast -n com.athlofit.athlofit/.MidnightResetReceiver

# 3. Wait 2 seconds
sleep 2

# 4. Check steps are 0
adb shell run-as com.athlofit.athlofit cat /data/data/com.athlofit.athlofit/shared_prefs/StepCounterPrefs.xml

# 5. Check logs for any errors
adb logcat -d -s StepCounterService:D MidnightResetReceiver:D | tail -20
```

Bas itna hi — 2 minute mein pura midnight flow test ho jayega! 🎯
