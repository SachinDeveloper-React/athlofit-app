# Emulator Midnight Testing — Step by Step Guide

Ye guide emulator pe midnight reset aur step crossover ke har scenario ko test karne ke liye hai.
Har test ke liye exactly kya command run karna hai, kya expect karna hai — sab likha hai.

---

## PRE-REQUISITES (Ek Baar Setup)

### 1. Emulator Start Karo
```bash
# Android Studio se API 34 Pixel emulator start karo
# Ya command line se:
emulator -avd Pixel_7_API_34 -writable-system
```

### 2. App Install Karo
```bash
npx react-native run-android
```

### 3. App Open Karo & Login Karo
- Emulator mein app open karo
- Login karo apne test account se
- Dashboard pe steps dikhne chahiye (0 ya kuch bhi)

### 4. Health Connect Permission Dedo
- App open hone pe HC permission dialog aayega → "Allow All" karo
- Verify: App mein steps section mein koi error nahi dikhna chahiye

### 5. Auto-Time OFF Karo (Important!)
```bash
adb shell settings put global auto_time 0
adb shell settings put global auto_time_zone 0
```

---

## TEST CASE 1: Normal Midnight Reset

**Goal:** Verify ki midnight pe steps correctly 0 ho jaate hain

### Commands:

```bash
# STEP 1: Current state check karo
adb shell run-as com.athlofit.athlofit cat /data/data/com.athlofit.athlofit/shared_prefs/StepCounterPrefs.xml
```
**Expected Output:** dailySteps ka kuch value hoga (0 ya kuch bhi)

```bash
# STEP 2: App mein fake steps set karo — pehle time ko aaj 6 PM set karo
adb shell date "07171800.00"
# (Format: MMDDhhmm.ss — July 17, 6:00 PM)
```

```bash
# STEP 3: Steps inject karo Health Connect mein
# Emulator mein app ke andar debugger console ya dev menu se:
# Ya seedha SharedPrefs edit karo:
adb shell am force-stop com.athlofit.athlofit

adb shell run-as com.athlofit.athlofit sh -c "
cat > /data/data/com.athlofit.athlofit/shared_prefs/StepCounterPrefs.xml << 'EOF'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name=\"storedDate\">2026-07-17</string>
    <int name=\"dailySteps\" value=\"5000\" />
    <int name=\"rebootOffset\" value=\"0\" />
    <long name=\"baseline\" value=\"0\" />
    <long name=\"lastCumulative\" value=\"5000\" />
</map>
EOF"
```

```bash
# STEP 4: App open karo — 5000 steps dikhna chahiye
adb shell am start -n com.athlofit.athlofit/.MainActivity
```
**Expected:** App/notification/widget mein ~5000 steps

```bash
# STEP 5: Time ko 11:58 PM set karo
adb shell date "07172358.00"
```

```bash
# STEP 6: Ab time ko 12:01 AM NEXT DAY set karo
adb shell date "07180001.00"
```

```bash
# STEP 7: MidnightResetReceiver broadcast karo (AlarmManager simulate)
adb shell am broadcast -n com.athlofit.athlofit/.MidnightResetReceiver
```

```bash
# STEP 8: 3 second wait karo
sleep 3
```

```bash
# STEP 9: Check karo — steps 0 hone chahiye
adb shell run-as com.athlofit.athlofit cat /data/data/com.athlofit.athlofit/shared_prefs/StepCounterPrefs.xml
```

### Expected Result:
```xml
<string name="storedDate">2026-07-18</string>
<int name="dailySteps" value="0" />
<int name="rebootOffset" value="0" />
```

### PASS: `dailySteps = 0` aur `storedDate = 2026-07-18` (next day)
### FAIL: `dailySteps = 5000` ya `storedDate` old hai

---

## TEST CASE 2: OEM Alarm Delay (Midnight Reset Late Fire)

**Goal:** Verify ki agar midnight alarm 10 min late fire ho, tab bhi steps leak nahi hote

### Commands:

```bash
# STEP 1: Steps set karo 7000 for today
adb shell am force-stop com.athlofit.athlofit

adb shell run-as com.athlofit.athlofit sh -c "
cat > /data/data/com.athlofit.athlofit/shared_prefs/StepCounterPrefs.xml << 'EOF'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name=\"storedDate\">2026-07-17</string>
    <int name=\"dailySteps\" value=\"7000\" />
    <int name=\"rebootOffset\" value=\"0\" />
    <long name=\"baseline\" value=\"0\" />
    <long name=\"lastCumulative\" value=\"7000\" />
</map>
EOF"
```

```bash
# STEP 2: Time ko NEXT DAY 12:10 AM set karo (alarm 10 min late)
# NOTE: storedDate abhi bhi "2026-07-17" hai — reset NAHI hua abhi tak
adb shell date "07180010.00"
```

```bash
# STEP 3: App open karo (WITHOUT midnight reset)
adb shell am start -n com.athlofit.athlofit/.MainActivity
```

```bash
# STEP 4: Logs check karo — handleDateChangeOnStart trigger hona chahiye
adb logcat -d -s StepCounterService:D | grep -E "handleDateChangeOnStart|maybeSync|skipping"
```

**Expected Logs:**
```
handleDateChangeOnStart — date changed from 2026-07-17 to 2026-07-18
maybeSync — skipping: storedDate=2026-07-17 != today=2026-07-18 (midnight reset pending)
```

```bash
# STEP 5: Ab manually midnight reset broadcast karo (alarm finally fires)
adb shell am broadcast -n com.athlofit.athlofit/.MidnightResetReceiver
sleep 3
```

```bash
# STEP 6: Verify steps are 0
adb shell run-as com.athlofit.athlofit cat /data/data/com.athlofit.athlofit/shared_prefs/StepCounterPrefs.xml
```

### PASS: 
- Step 4 mein log shows "date changed" aur "skipping" (no sync with stale data)
- Step 6 mein dailySteps = 0, storedDate = 2026-07-18

### FAIL: 
- Agar Step 4 mein sync ho gaya with 7000 steps under new date
- Ya Step 6 mein dailySteps still 7000

---

## TEST CASE 3: Smartwatch Late Write (HC 12:05 AM Case)

**Goal:** Verify ki agar watch 12:05 AM pe yesterday ke steps HC mein write kare (with today ka timestamp), toh vo today ke steps mein add nahi hote

### Commands:

```bash
# STEP 1: Clean slate — reset everything
adb shell am force-stop com.athlofit.athlofit

adb shell run-as com.athlofit.athlofit sh -c "
cat > /data/data/com.athlofit.athlofit/shared_prefs/StepCounterPrefs.xml << 'EOF'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name=\"storedDate\">2026-07-18</string>
    <int name=\"dailySteps\" value=\"0\" />
    <int name=\"rebootOffset\" value=\"0\" />
    <long name=\"baseline\" value=\"0\" />
    <long name=\"lastCumulative\" value=\"0\" />
</map>
EOF"
```

```bash
# STEP 2: Time set karo 12:05 AM (just after midnight)
adb shell date "07180005.00"
```

```bash
# STEP 3: App start karo
adb shell am start -n com.athlofit.athlofit/.MainActivity
sleep 5
```

```bash
# STEP 4: Ab Health Connect mein fake "watch" data inject karo
# Ye simulate karta hai ki watch ne 12:05 AM pe yesterday ke steps write kiye
# with a startTime of 11:55 PM yesterday and endTime 12:05 AM today
# (This is what Galaxy Watch / Fitbit does — batch write crosses midnight)

# Iske liye app ke debugger console mein ye run karo:
```

**In Flipper/Debugger Console:**
```javascript
const { insertRecords, initialize } = require('react-native-health-connect');

await initialize();

// Simulate: Watch writes yesterday's steps at 12:05 AM with cross-midnight timestamps
await insertRecords([{
  recordType: 'Steps',
  count: 3000,
  startTime: '2026-07-17T23:55:00.000Z',  // Started yesterday 11:55 PM
  endTime: '2026-07-18T00:05:00.000Z',     // Ended today 12:05 AM
}]);

console.log('✓ Injected cross-midnight watch record (3000 steps, 23:55→00:05)');
```

```bash
# STEP 5: Ab app mein health data refresh trigger karo
# (App foreground mein hai toh automatic hoga, ya pull-to-refresh karo)
```

```bash
# STEP 6: Logs check karo — midnight bleed guard filter karna chahiye
adb logcat -d -s HealthConnect:D | grep -i "midnight\|bleed\|filter\|origin"
```

```bash
# STEP 7: Steps check karo
adb shell run-as com.athlofit.athlofit cat /data/data/com.athlofit.athlofit/shared_prefs/StepCounterPrefs.xml
```

### PASS:
- Steps 0 ya bahut kam (not 3000)
- Log mein "cross-midnight records filtered" jaisa kuch dikhna chahiye
- `readStepsDeduped` ne records filter kiye because `recStart (23:55 yesterday) < requestedStart (00:00 today)`

### FAIL:
- Steps 3000 dikh rahe — watch ke stale steps today mein aa gaye

### WHY IT SHOULD PASS:
Code mein `readStepsDeduped()` ke andar ye guard hai:
```typescript
const filteredRecords = records.filter((r: any) => {
  const recStart = new Date(r.startTime).getTime();
  return recStart >= requestedStart;  // 23:55 PM < 00:00 AM → FILTERED OUT
});
```

---

## TEST CASE 4: Watch Writes with TODAY's Timestamp (Edge Case!)

**Goal:** Ye tricky case hai — watch yesterday ke steps write karta hai BUT `startTime` TODAY ka 12:01 AM rakhta hai (kuch watches aisa karti hain)

### Commands:

```bash
# STEP 1: Same clean slate as Test 3
adb shell am force-stop com.athlofit.athlofit

adb shell run-as com.athlofit.athlofit sh -c "
cat > /data/data/com.athlofit.athlofit/shared_prefs/StepCounterPrefs.xml << 'EOF'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name=\"storedDate\">2026-07-18</string>
    <int name=\"dailySteps\" value=\"0\" />
    <int name=\"rebootOffset\" value=\"0\" />
    <long name=\"baseline\" value=\"0\" />
    <long name=\"lastCumulative\" value=\"0\" />
</map>
EOF"
```

```bash
# STEP 2: Time 12:05 AM
adb shell date "07180005.00"
```

```bash
# STEP 3: App start
adb shell am start -n com.athlofit.athlofit/.MainActivity
sleep 5
```

**In Flipper/Debugger Console:**
```javascript
const { insertRecords, initialize } = require('react-native-health-connect');

await initialize();

// Simulate: Watch writes yesterday's steps BUT with TODAY's timestamp
// (Some watches batch-sync and write with current time, not actual time)
await insertRecords([{
  recordType: 'Steps',
  count: 4500,
  startTime: '2026-07-18T00:01:00.000Z',  // Today 12:01 AM (!) 
  endTime: '2026-07-18T00:05:00.000Z',     // Today 12:05 AM
}]);

console.log('✓ Injected watch record with TODAY timestamp (4500 steps, 00:01→00:05)');
```

```bash
# STEP 4: Health data refresh karo (foreground ya pull-to-refresh)
sleep 10
```

```bash
# STEP 5: Steps check karo
adb shell run-as com.athlofit.athlofit cat /data/data/com.athlofit.athlofit/shared_prefs/StepCounterPrefs.xml
```

```bash
# STEP 6: Logs
adb logcat -d -s HealthConnect:D StepCounterService:D | grep -i "steps\|origin\|plausible"
```

### ⚠️ EXPECTED RESULT — YE CASE PASS NAHI HOGA (Known Edge Case):
- Steps **4500 dikh jayenge** because:
  - startTime `00:01 AM today` >= requestedStart `00:00 AM today`
  - Midnight bleed guard is record ko filter NAHI karega
  - Ye record "today" ka lagta hai system ko

### WHY:
Current `readStepsDeduped` sirf `startTime < requestedStart` filter karta hai.
Agar watch ne today ka timestamp likh diya, toh code ke paas koi way nahi pehchanne ka ki ye actually yesterday ke steps hain.

### POSSIBLE FIX (for background sync):
`backgroundSync.service.ts` mein 5-minute post-midnight guard hai:
```
if (dateStr === todayStr && minutesSinceMidnight < 5) {
  const maxPlausible = Math.max(200, minutesSinceMidnight * 180 + 100);
  if (steps > maxPlausible) → SKIP
}
```
At 12:05, maxPlausible = `5 * 180 + 100 = 1000`. Since 4500 > 1000, **background sync would skip it!**

But the **app UI** would still show 4500 until the next refresh after 5 minutes.

---

## TEST CASE 5: Background Sync — Stale Data Guard

**Goal:** Verify ki background sync yesterday ke steps ko today's date ke saath server pe nahi bhejta

### Commands:

```bash
# STEP 1: Setup — 6000 steps from yesterday
adb shell am force-stop com.athlofit.athlofit

adb shell run-as com.athlofit.athlofit sh -c "
cat > /data/data/com.athlofit.athlofit/shared_prefs/StepCounterPrefs.xml << 'EOF'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name=\"storedDate\">2026-07-17</string>
    <int name=\"dailySteps\" value=\"6000\" />
    <int name=\"rebootOffset\" value=\"0\" />
    <long name=\"baseline\" value=\"0\" />
    <long name=\"lastCumulative\" value=\"6000\" />
</map>
EOF"
```

```bash
# STEP 2: Time next day 12:03 AM (within 5-min guard window)
adb shell date "07180003.00"
```

```bash
# STEP 3: App start — BINA midnight reset ke (simulating alarm delay)
adb shell am start -n com.athlofit.athlofit/.MainActivity
sleep 5
```

```bash
# STEP 4: Check kya native service ne sync kiya
adb logcat -d -s StepCounterService:D | grep -i "maybeSync\|skipping\|staleness"
```

### PASS:
Log mein dikhna chahiye:
```
maybeSync — skipping: storedDate=2026-07-17 != today=2026-07-18 (midnight reset pending)
```

### FAIL:
Agar sync ho gaya with 6000 steps under date 2026-07-18

---

## TEST CASE 6: Widget & Notification Reset

**Goal:** Verify widget aur notification bhi 0 dikhate hain midnight ke baad

### Commands:

```bash
# STEP 1: Widget prefs mein steps set karo
adb shell run-as com.athlofit.athlofit sh -c "
cat > /data/data/com.athlofit.athlofit/shared_prefs/StepsWidgetPrefs.xml << 'EOF'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <int name=\"steps\" value=\"8000\" />
    <int name=\"goal\" value=\"10000\" />
    <float name=\"weightKg\" value=\"70.0\" />
</map>
EOF"
```

```bash
# STEP 2: Widget refresh karo (verify 8000 dikh raha hai)
adb shell am broadcast -n com.athlofit.athlofit/.WidgetAlarmReceiver
sleep 2
```

```bash
# STEP 3: Midnight reset trigger karo
adb shell date "07180001.00"
adb shell am broadcast -n com.athlofit.athlofit/.MidnightResetReceiver
sleep 3
```

```bash
# STEP 4: Widget prefs check karo
adb shell run-as com.athlofit.athlofit cat /data/data/com.athlofit.athlofit/shared_prefs/StepsWidgetPrefs.xml
```

### PASS: Widget steps = 0
### FAIL: Widget still shows 8000

---

## TEST CASE 7: Multi-Day Gap (Phone OFF for 2 Days)

**Goal:** Verify ki agar phone 2 din band tha, toh old steps intermediate days mein leak nahi hote

### Commands:

```bash
# STEP 1: Set storedDate to 2 days ago with 4000 steps
adb shell am force-stop com.athlofit.athlofit

adb shell run-as com.athlofit.athlofit sh -c "
cat > /data/data/com.athlofit.athlofit/shared_prefs/StepCounterPrefs.xml << 'EOF'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name=\"storedDate\">2026-07-15</string>
    <int name=\"dailySteps\" value=\"4000\" />
    <int name=\"rebootOffset\" value=\"0\" />
    <long name=\"baseline\" value=\"0\" />
    <long name=\"lastCumulative\" value=\"4000\" />
</map>
EOF"
```

```bash
# STEP 2: Time today set karo
adb shell date "07180900.00"
```

```bash
# STEP 3: App start karo
adb shell am start -n com.athlofit.athlofit/.MainActivity
sleep 5
```

```bash
# STEP 4: Logs check karo — handleMultiDayGap trigger hona chahiye
adb logcat -d -s StepCounterService:D | grep -i "multiDayGap\|intermediate\|persisted"
```

### Expected Logs:
```
handleMultiDayGap — persisted 4000 steps for 2026-07-15
handleMultiDayGap — recorded 0 steps for intermediate day 2026-07-16
handleMultiDayGap — recorded 0 steps for intermediate day 2026-07-17
```

```bash
# STEP 5: Final state check
adb shell run-as com.athlofit.athlofit cat /data/data/com.athlofit.athlofit/shared_prefs/StepCounterPrefs.xml
```

### PASS:
- storedDate = 2026-07-18 (today)
- dailySteps = 0
- Intermediate days (16, 17) got 0 steps (not 4000)

### FAIL:
- Intermediate days got 4000 steps
- Or today shows 4000

---

## CLEANUP: Test Ke Baad

```bash
# Auto-time wapas ON karo
adb shell settings put global auto_time 1
adb shell settings put global auto_time_zone 1

# App restart karo clean state mein
adb shell am force-stop com.athlofit.athlofit
adb shell am start -n com.athlofit.athlofit/.MainActivity
```

---

## QUICK REFERENCE: All Test Scenarios

| # | Test | Kya Check Ho Raha Hai | Expected |
|---|------|----------------------|----------|
| 1 | Normal Midnight Reset | Steps 0 after midnight | PASS |
| 2 | OEM Alarm Delay | No sync during delay | PASS |
| 3 | Watch Late Write (yesterday timestamp) | Midnight bleed guard filters | PASS |
| 4 | Watch Late Write (today timestamp) | Post-midnight plausibility guard | ⚠️ EDGE CASE |
| 5 | Background Sync Stale Guard | No stale sync to server | PASS |
| 6 | Widget/Notification Reset | Shows 0 after midnight | PASS |
| 7 | Multi-Day Gap | Intermediate days get 0 | PASS |

---

## TROUBLESHOOTING

### "adb shell date" kaam nahi kar raha
```bash
# Emulator pe root access chahiye:
adb root
# Phir retry karo:
adb shell date "07180001.00"
```

### App crash ho rahi hai after prefs edit
```bash
# Prefs file ka format galat hai — puri file overwrite karo:
adb shell run-as com.athlofit.athlofit sh -c "rm /data/data/com.athlofit.athlofit/shared_prefs/StepCounterPrefs.xml"
# Phir app restart — fresh prefs create hogi
adb shell am start -n com.athlofit.athlofit/.MainActivity
```

### Health Connect steps inject nahi ho rahe
```bash
# Permission check:
adb shell dumpsys package com.athlofit.athlofit | grep -i "health"
# HC app open karo emulator mein and manually grant all permissions
```

### Logcat mein kuch nahi dikh raha
```bash
# Clear logcat buffer first:
adb logcat -c
# Phir action karo, phir read:
adb logcat -d -s StepCounterService:D MidnightResetReceiver:D HealthSyncHelper:D
```
