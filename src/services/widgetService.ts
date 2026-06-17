// src/services/widgetService.ts
import { NativeModules, Platform } from 'react-native';
import { stepService } from './stepService';

interface StepsWidgetNativeModule {
  updateWidget: (steps: number, goal: number) => Promise<boolean>;
  startAutoUpdate: () => Promise<boolean>;
  stopAutoUpdate: () => Promise<boolean>;
  setLoginTimestamp: (timestamp: number) => Promise<boolean>;
  clearLoginTimestamp: () => Promise<boolean>;
  setLoggedOut: (loggedOut: boolean) => Promise<boolean>;
  setMaintenance: (enabled: boolean, message: string) => Promise<boolean>;
  isWidgetAdded: () => Promise<boolean>;
  setAppInitialising: (initialising: boolean) => Promise<boolean>;
  scheduleEodSync: () => Promise<boolean>;
  cancelEodSync: () => Promise<boolean>;
  saveAccessToken: (token: string) => Promise<boolean>;
  clearAccessToken: () => Promise<boolean>;
  saveUserWeight: (weightKg: number) => Promise<boolean>;
  clearUserWeight: () => Promise<boolean>;
  startStepNotification: () => Promise<boolean>;
  stopStepNotification: () => Promise<boolean>;
}

const { StepsWidget } = NativeModules;

class WidgetService {
  private module: StepsWidgetNativeModule | null = null;

  constructor() {
    if (Platform.OS === 'android' && StepsWidget) {
      this.module = StepsWidget as StepsWidgetNativeModule;
    }
  }

  isAvailable(): boolean {
    return Platform.OS === 'android' && this.module !== null;
  }

  /** Push current steps/goal to widget immediately (app is open). */
  async updateWidget(steps: number, goal: number): Promise<boolean> {
    if (!this.module) return false;
    try {
      await this.module.updateWidget(steps, goal);
      return true;
    } catch (e) {
      console.warn('[WidgetService] updateWidget failed:', e);
      return false;
    }
  }

  /**
   * Start the WorkManager background job that reads Health Connect every 15 min.
   * Call this on login.
   */
  async startAutoUpdate(): Promise<boolean> {
    if (!this.module) return false;
    try {
      await this.module.startAutoUpdate();
      console.log('[WidgetService] Auto-update started');
      return true;
    } catch (e) {
      console.warn('[WidgetService] startAutoUpdate failed:', e);
      return false;
    }
  }

  /**
   * Cancel the background job.
   * Call this on logout.
   */
  async stopAutoUpdate(): Promise<boolean> {
    if (!this.module) return false;
    try {
      await this.module.stopAutoUpdate();
      console.log('[WidgetService] Auto-update stopped');
      return true;
    } catch (e) {
      console.warn('[WidgetService] stopAutoUpdate failed:', e);
      return false;
    }
  }

  /**
   * Save login timestamp so the background worker filters steps correctly.
   * Call this right after login.
   */
  async setLoginTimestamp(timestamp: number): Promise<boolean> {
    if (!this.module) return false;
    try {
      await this.module.setLoginTimestamp(timestamp);
      return true;
    } catch (e) {
      console.warn('[WidgetService] setLoginTimestamp failed:', e);
      return false;
    }
  }

  /** Clear login timestamp on logout. */
  async clearLoginTimestamp(): Promise<boolean> {
    if (!this.module) return false;
    try {
      await this.module.clearLoginTimestamp();
      return true;
    } catch (e) {
      console.warn('[WidgetService] clearLoginTimestamp failed:', e);
      return false;
    }
  }

  /**
   * Set the widget to "logged out" state.
   * Shows "You are logged out" message on the widget.
   * Call this on logout. Pass false on login to restore normal display.
   */
  async setLoggedOut(loggedOut: boolean): Promise<boolean> {
    if (!this.module) return false;
    try {
      await this.module.setLoggedOut(loggedOut);
      return true;
    } catch (e) {
      console.warn('[WidgetService] setLoggedOut failed:', e);
      return false;
    }
  }

  /**
   * Shows maintenance message on the widget when app is under maintenance.
   * Pass enabled=false to restore normal display when maintenance ends.
   */
  async setMaintenance(enabled: boolean, message: string): Promise<boolean> {
    if (!this.module) return false;
    try {
      await this.module.setMaintenance(enabled, message);
      return true;
    } catch (e) {
      console.warn('[WidgetService] setMaintenance failed:', e);
      return false;
    }
  }

  async isWidgetAdded(): Promise<boolean> {
    if (!this.module) return false;
    try {
      return await this.module.isWidgetAdded();
    } catch (e) {
      return false;
    }
  }

  /**
   * Tell the native WidgetUpdateWorker whether the app is currently
   * initialising Health Connect. While true, the background worker skips
   * its HC read to prevent a concurrent-access crash on app startup.
   *
   * Call setAppInitialising(true) before initialize()/requestPermission(),
   * and setAppInitialising(false) once setup is complete.
   */
  async setAppInitialising(initialising: boolean): Promise<void> {
    if (!this.module) return;
    try {
      await this.module.setAppInitialising(initialising);
    } catch (e) {
      console.warn('[WidgetService] setAppInitialising failed:', e);
    }
  }

  /**
   * Schedule the native 23:59:50 end-of-day health sync alarm.
   * Uses AlarmManager.setExactAndAllowWhileIdle — fires even in Doze mode
   * with the app fully closed. Call this on login.
   */
  async scheduleEodSync(): Promise<boolean> {
    if (!this.module) return false;
    try {
      await this.module.scheduleEodSync();
      console.log('[WidgetService] EOD sync alarm scheduled');
      return true;
    } catch (e) {
      console.warn('[WidgetService] scheduleEodSync failed:', e);
      return false;
    }
  }

  /**
   * Cancel the end-of-day sync alarm.
   * Call this on logout.
   */
  async cancelEodSync(): Promise<boolean> {
    if (!this.module) return false;
    try {
      await this.module.cancelEodSync();
      console.log('[WidgetService] EOD sync alarm cancelled');
      return true;
    } catch (e) {
      console.warn('[WidgetService] cancelEodSync failed:', e);
      return false;
    }
  }

  /**
   * Mirror the access token into StepsWidgetPrefs so EodSyncWorker can
   * attach it to /health/sync without needing the app open.
   * Call this on login AND every time the token is refreshed (401 → refresh).
   */
  async saveAccessToken(token: string): Promise<boolean> {
    if (!this.module) return false;
    try {
      await this.module.saveAccessToken(token);
      return true;
    } catch (e) {
      console.warn('[WidgetService] saveAccessToken failed:', e);
      return false;
    }
  }

  /**
   * Remove the mirrored access token on logout.
   */
  async clearAccessToken(): Promise<boolean> {
    if (!this.module) return false;
    try {
      await this.module.clearAccessToken();
      return true;
    } catch (e) {
      console.warn('[WidgetService] clearAccessToken failed:', e);
      return false;
    }
  }

  /**
   * Save the user's weight (kg) so native background workers use the real
   * value for calorie/distance derivation instead of the 70 kg default.
   * Call this on login and whenever the user updates their profile weight.
   */
  async saveUserWeight(weightKg: number): Promise<boolean> {
    if (!this.module) return false;
    try {
      await this.module.saveUserWeight(weightKg);
      return true;
    } catch (e) {
      console.warn('[WidgetService] saveUserWeight failed:', e);
      return false;
    }
  }

  /** Remove the stored weight on logout. */
  async clearUserWeight(): Promise<boolean> {
    if (!this.module) return false;
    try {
      await this.module.clearUserWeight();
      return true;
    } catch (e) {
      console.warn('[WidgetService] clearUserWeight failed:', e);
      return false;
    }
  }

  /**
   * Start the persistent step-count foreground notification.
   * Shows live today's steps in the Android notification shade.
   * Call this on login (after POST_NOTIFICATIONS permission is granted).
   *
   * When the native step counter is active, the StepCounterService already
   * manages its own foreground notification, so we skip the legacy
   * StepNotificationService to avoid duplicate notifications.
   */
  async startStepNotification(): Promise<boolean> {
    if (!this.module) return false;
    if (stepService.getSource() === 'native_sensor') {
      console.log('[WidgetService] Skipping startStepNotification — native step counter manages its own notification');
      return true;
    }
    try {
      await this.module.startStepNotification();
      console.log('[WidgetService] Step notification started');
      return true;
    } catch (e) {
      console.warn('[WidgetService] startStepNotification failed:', e);
      return false;
    }
  }

  /**
   * Stop the persistent step-count foreground notification.
   * Call this on logout.
   *
   * When the native step counter is active, the StepCounterService manages
   * its own lifecycle, so we skip the legacy StepNotificationService stop call.
   */
  async stopStepNotification(): Promise<boolean> {
    if (!this.module) return false;
    if (stepService.getSource() === 'native_sensor') {
      console.log('[WidgetService] Skipping stopStepNotification — native step counter manages its own notification');
      return true;
    }
    try {
      await this.module.stopStepNotification();
      console.log('[WidgetService] Step notification stopped');
      return true;
    } catch (e) {
      console.warn('[WidgetService] stopStepNotification failed:', e);
      return false;
    }
  }
}

export const widgetService = new WidgetService();
