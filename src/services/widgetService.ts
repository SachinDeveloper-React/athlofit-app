// src/services/widgetService.ts
import { NativeModules, Platform } from 'react-native';

interface StepsWidgetNativeModule {
  updateWidget: (steps: number, goal: number) => Promise<boolean>;
  startAutoUpdate: () => Promise<boolean>;
  stopAutoUpdate: () => Promise<boolean>;
  setLoginTimestamp: (timestamp: number) => Promise<boolean>;
  clearLoginTimestamp: () => Promise<boolean>;
  isWidgetAdded: () => Promise<boolean>;
  setAppInitialising: (initialising: boolean) => Promise<boolean>;
  scheduleEodSync: () => Promise<boolean>;
  cancelEodSync: () => Promise<boolean>;
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
}

export const widgetService = new WidgetService();
