# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in proguard-android-optimize.txt (see the release buildType in build.gradle),
# which enables R8's optimization passes on top of shrinking and obfuscation.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ── WorkManager workers ───────────────────────────────────────────────────────
#
# WorkManager persists the worker's class NAME as a string in its database at
# enqueue time and reflects it back when the work actually runs — which can be
# after an app update. R8 is free to pick a different obfuscated name in the
# next release, and then work scheduled by the previous version resolves to a
# class that no longer exists and is dropped on the floor. That silently kills
# the end-of-day sync, the midnight reset and the widget refresh for exactly
# the users who had work pending across the upgrade, which is everybody.
#
# Pinning the names costs a few bytes and makes the schedule survive updates.
-keep class com.athlofit.EodSyncWorker { *; }
-keep class com.athlofit.MidnightResetWorker { *; }
-keep class com.athlofit.WidgetUpdateWorker { *; }

# ── Crashlytics readability ───────────────────────────────────────────────────
#
# Release builds upload a mapping file (see firebaseCrashlytics in build.gradle),
# but line numbers still have to survive minification for the retraced stack
# trace to point at a line rather than just a method.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
