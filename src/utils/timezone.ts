// src/utils/timezone.ts
//
// FIX #3: Provides the device's IANA timezone name for health sync payloads.
// This ensures the server uses the user's local day boundary for coin calculations.

import { Platform, NativeModules } from 'react-native';

/**
 * Returns the device's IANA timezone name (e.g., "Asia/Kolkata", "America/New_York").
 * Uses react-native-localize if available, otherwise falls back to
 * Intl.DateTimeFormat().resolvedOptions().timeZone (available on modern RN engines).
 *
 * Falls back to null if timezone cannot be determined (server will use IST).
 */
export function getTimezone(): string | null {
  try {
    // Modern Hermes/JSC support Intl.DateTimeFormat with resolvedOptions
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz.includes('/')) {
      return tz;
    }
  } catch {
    // Intl not available — continue to fallback
  }

  // Fallback: try to get timezone from native modules if available
  try {
    if (Platform.OS === 'android') {
      // Android exposes timezone via settings
      const { SettingsModule } = NativeModules;
      if (SettingsModule?.getTimezone) {
        return SettingsModule.getTimezone() || null;
      }
    }
  } catch {
    // Native module not available
  }

  // Last resort: return null — server will default to IST
  return null;
}
