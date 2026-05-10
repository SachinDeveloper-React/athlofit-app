/**
 * profileSync.service.ts
 *
 * Writes the user's profile data (weight, height) to Health Connect / HealthKit
 * on login so that:
 *  1. The JS health service uses the real weight for calorie/distance derivation
 *  2. Native background workers (WidgetUpdateWorker, EodSyncWorker) read the
 *     real weight from StepsWidgetPrefs instead of the 70 kg default
 *  3. Health Connect has an up-to-date Weight record for other apps to read
 *
 * Call syncProfileToHealthPlatform() right after login / session restore.
 */

import { Platform } from 'react-native';
import { writeWeightHC } from './healthConnect.service';
import { writeWeightHK as writeWeightHealthKit } from './healthkit.service';
import { widgetService } from '../../../services/widgetService';

interface UserProfile {
  weight?: number | null; // kg
  height?: number | null; // cm
}

/**
 * Write the user's weight to Health Connect (Android) or HealthKit (iOS),
 * and persist it to StepsWidgetPrefs for native background workers.
 *
 * Safe to call multiple times — each call just upserts the latest value.
 */
export async function syncProfileToHealthPlatform(
  profile: UserProfile,
): Promise<void> {
  const weightKg = profile.weight;
  if (!weightKg || weightKg <= 0) return;

  const now = new Date();

  try {
    if (Platform.OS === 'android') {
      // 1. Write weight record to Health Connect
      await writeWeightHC(weightKg, now).catch(e =>
        console.warn('[ProfileSync] writeWeightHC failed:', e),
      );

      // 2. Persist to StepsWidgetPrefs so native workers use the real weight
      await widgetService.saveUserWeight(weightKg);
    } else if (Platform.OS === 'ios') {
      // Write weight record to HealthKit
      await writeWeightHealthKit(weightKg, now).catch(e =>
        console.warn('[ProfileSync] writeWeightHK failed:', e),
      );
    }

    console.log(`[ProfileSync] Weight synced to health platform: ${weightKg} kg`);
  } catch (e) {
    // Non-fatal — health platform write failures should never block login
    console.warn('[ProfileSync] syncProfileToHealthPlatform failed:', e);
  }
}
