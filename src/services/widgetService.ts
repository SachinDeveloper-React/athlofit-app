// src/services/widgetService.ts
import { NativeModules, Platform } from 'react-native';

interface StepsWidgetNativeModule {
  updateWidget: (steps: number, goal: number) => Promise<boolean>;
  startAutoUpdate: () => Promise<boolean>;
  stopAutoUpdate: () => Promise<boolean>;
  setLoginTimestamp: (timestamp: number) => Promise<boolean>;
  clearLoginTimestamp: () => Promise<boolean>;
  isWidgetAdded: () => Promise<boolean>;
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
}

export const widgetService = new WidgetService();
