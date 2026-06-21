import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { tokenService } from '../service/tokenService';
import { authService } from '../service/authService';
import type { AuthState, AuthTokens, User } from '../../../types/auth.types';
import { mmkvStorage } from '../../../store';
import { clearFcmToken } from '../../../services/fcmService';
import { setIsLoggingOut } from '../../../utils/logoutGuard';

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    immer((set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAccessToken: (accessToken: string) => {
        set(state => {
          state.accessToken = accessToken;
          state.isAuthenticated = true;
        });
      },
      // ── Called on successful login / register ───────────────────────────────
      // BUG-047: setAuth is async and awaits tokenService.save so tokens are
      // persisted to Keychain before the store state is updated. Previously
      // the save was fire-and-forget — a crash/background immediately after
      // login could leave the user with store state but no persisted tokens.
      setAuth: async (user: User, tokens: AuthTokens) => {
        await tokenService.save(tokens);
        set(state => {
          state.user = user;
          state.accessToken = tokens.accessToken;
          state.isAuthenticated = true;
        });

        const loginTs = Date.now();

        // Set login timestamp to filter historical Health Connect data
        import('../../health/store/healthDataStore').then(({ useHealthDataStore }) => {
          useHealthDataStore.getState().setLoginTimestamp(loginTs);
        });

        // Sync login timestamp to native widget + start background auto-update + EOD alarm
        import('../../../services/widgetService').then(({ widgetService }) => {
          widgetService.setLoggedOut(false);                  // restore normal widget display
          widgetService.setLoginTimestamp(loginTs);
          widgetService.startAutoUpdate();
          widgetService.scheduleEodSync();
          widgetService.saveAccessToken(tokens.accessToken); // for EodSyncWorker
          widgetService.startStepNotification();             // live step count in notification
          // Persist user weight so native workers use the real value
          if (user.weight && user.weight > 0) {
            widgetService.saveUserWeight(user.weight);
          }
        });

        // Write weight/height to Health Connect / HealthKit so the platform
        // has an up-to-date record and derivation uses the real body metrics.
        import('../../health/service/profileSync.service').then(({ syncProfileToHealthPlatform }) => {
          syncProfileToHealthPlatform({ weight: user.weight, height: user.height });
        });

        // Auto-calculate and save BMI if user has both height and weight
        if (user.weight && user.weight > 0 && user.height && user.height > 0) {
          import('../../health/service/bmi.service').then(({ bmiService }) => {
            bmiService.getHistory(1).then(history => {
              const heightM = user.height / 100;
              // Skip if the latest record already has the same weight and height
              if (history.length > 0) {
                const last = history[0];
                if (last.weight === user.weight && Math.abs(last.height - heightM) < 0.01) {
                  return; // No change — skip
                }
              }
              bmiService.save({ weight: user.weight, height: heightM }).catch(() => {});
            }).catch(() => {});
          });
        }

        // Register FCM token now that we have a session
        import('../../../services/fcmService').then(({ registerFcmToken }) =>
          registerFcmToken(),
        );
      },

      // ── Called on app launch — restore session from Keychain ────────────────
      // Strategy: use persisted user from MMKV immediately (no network wait),
      // then refresh profile in the background after the app is visible.
      setTokensFromStorage: async () => {
        const tokens = await tokenService.getTokens();
        if (!tokens) return;

        // Mark as authenticated immediately using persisted user data from MMKV.
        // The user object is already in the store from the last session (partialize).
        // This lets the splash screen hide instantly without waiting for the network.
        set(state => {
          state.accessToken = tokens.accessToken;
          state.isAuthenticated = true;
          // user is already populated from MMKV persist — no need to set it here
        });

        // Refresh profile from server in the background (non-blocking)
        authService.me().then(res => {
          if (res.data) {
            set(state => { state.user = res.data; });
          }

          // Set login timestamp if not already set
          import('../../health/store/healthDataStore').then(({ useHealthDataStore }) => {
            const currentTimestamp = useHealthDataStore.getState().loginTimestamp;
            if (!currentTimestamp) {
              const ts = Date.now();
              useHealthDataStore.getState().setLoginTimestamp(ts);
              import('../../../services/widgetService').then(({ widgetService }) => {
                widgetService.setLoginTimestamp(ts);
                widgetService.startAutoUpdate();
                widgetService.scheduleEodSync();
                widgetService.saveAccessToken(tokens.accessToken);
                widgetService.startStepNotification();
                if (res.data?.weight && res.data.weight > 0) {
                  widgetService.saveUserWeight(res.data.weight);
                }
              });
            } else {
              import('../../../services/widgetService').then(({ widgetService }) => {
                widgetService.startAutoUpdate();
                widgetService.scheduleEodSync();
                widgetService.saveAccessToken(tokens.accessToken);
                widgetService.startStepNotification();
                if (res.data?.weight && res.data.weight > 0) {
                  widgetService.saveUserWeight(res.data.weight);
                }
              });
            }

            // Write weight/height to Health Connect / HealthKit
            if (res.data?.weight || res.data?.height) {
              import('../../health/service/profileSync.service').then(({ syncProfileToHealthPlatform }) => {
                syncProfileToHealthPlatform({ weight: res.data?.weight, height: res.data?.height });
              });
            }

            // Auto-calculate and save BMI if user has both height and weight
            if (res.data?.weight && res.data.weight > 0 && res.data?.height && res.data.height > 0) {
              import('../../health/service/bmi.service').then(({ bmiService }) => {
                bmiService.getHistory(1).then(history => {
                  const heightM = res.data.height / 100;
                  // Skip if the latest record already has the same weight and height
                  if (history.length > 0) {
                    const last = history[0];
                    if (last.weight === res.data.weight && Math.abs(last.height - heightM) < 0.01) {
                      return; // No change — skip
                    }
                  }
                  bmiService.save({ weight: res.data.weight, height: heightM }).catch(() => {});
                }).catch(() => {});
              });
            }
          });
        }).catch(async (err) => {
          // Only logout on a definitive auth rejection (401/403).
          // Network errors, 5xx, or timeouts should NOT log the user out —
          // the session is still valid, the server is just temporarily unreachable.
          const statusCode = (err as any)?.statusCode;
          if (statusCode === 401 || statusCode === 403) {
            await get().logout();
          }
        });
      },

      // ── Logout ──────────────────────────────────────────────────────────────
      logout: async () => {
        // Set the guard immediately — any 401 that arrives while we're
        // logging out will throw directly instead of triggering another logout.
        setIsLoggingOut(true);

        try {
          // Grab the access token BEFORE clearing so we can still call the backend
          const currentToken = await tokenService.getAccessToken();

          // Clear local state first so navigation redirects to sign-in immediately
          set(state => {
            state.user = null;
            state.accessToken = null;
            state.isAuthenticated = false;
          });

          // Clear tokens from Keychain before any network calls so that
          // clearFcmToken's hasSession check returns null and skips its API call
          await tokenService.clear();

          // Best-effort server-side cleanup — both use raw fetch (not api.post)
          // so they can never trigger the refresh → logout cycle
          try { await clearFcmToken(); } catch { /* silent */ }
          try { await authService.logoutWithToken(currentToken); } catch { /* silent */ }

        } finally {
          setIsLoggingOut(false);
        }

        // Stop widget background updates, cancel EOD alarm, and clear login timestamp + token
        import('../../../services/widgetService').then(({ widgetService }) => {
          widgetService.stopAutoUpdate();
          widgetService.cancelEodSync();
          widgetService.clearLoginTimestamp();
          widgetService.clearAccessToken();
          widgetService.clearUserWeight();     // remove mirrored weight
          widgetService.stopStepNotification(); // dismiss live step notification
          widgetService.setLoggedOut(true);     // show "You are logged out" on widget
        });

        // Clear user-specific stores to prevent data leakage between accounts
        // BUG-048: Each dynamic import is individually wrapped in try/catch so
        // a single import failure cannot leave the app in a broken half-reset state.
        try {
          const { useGamificationStore } = await import('../../health/store/gamificationStore');
          useGamificationStore.getState().reset();
        } catch (err) {
          console.error('[logout] failed to reset gamificationStore:', err);
        }

        try {
          const { useHydrationStore } = await import('../../health/store/hydrationStore');
          useHydrationStore.getState().reset();
        } catch (err) {
          console.error('[logout] failed to reset hydrationStore:', err);
        }

        try {
          const { useHealthDataStore } = await import('../../health/store/healthDataStore');
          useHealthDataStore.getState().reset();
        } catch (err) {
          console.error('[logout] failed to reset healthDataStore:', err);
        }

        try {
          const { useHealthInitStore } = await import('../../health/store/healthInitStore');
          useHealthInitStore.getState().reset();
        } catch (err) {
          console.error('[logout] failed to reset healthInitStore:', err);
        }
      },

      // ── Partial user update (e.g. after edit profile) ───────────────────────
      updateUser: (partial: Partial<User>) => {
        set(state => {
          if (state.user) Object.assign(state.user, partial);
        });

        // If weight changed, re-sync to health platform and native prefs
        if (partial.weight && partial.weight > 0) {
          import('../../../services/widgetService').then(({ widgetService }) => {
            widgetService.saveUserWeight(partial.weight!);
          });
          import('../../health/service/profileSync.service').then(({ syncProfileToHealthPlatform }) => {
            syncProfileToHealthPlatform({ weight: partial.weight, height: partial.height });
          });
        }
      },
    })),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => mmkvStorage),
      // Only persist non-sensitive fields — tokens live in Keychain
      partialize: state => ({ user: state.user }),
    },
  ),
);
