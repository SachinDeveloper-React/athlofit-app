import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { tokenService } from '../service/tokenService';
import { authService } from '../service/authService';
import type { AuthState, AuthTokens, User } from '../../../types/auth.types';
import { mmkvStorage } from '../../../store';
import { clearFcmToken } from '../../../services/fcmService';

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
      setAuth: (user: User, tokens: AuthTokens) => {
        tokenService.save(tokens);
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

        // Sync login timestamp to native widget + start background auto-update
        import('../../../services/widgetService').then(({ widgetService }) => {
          widgetService.setLoginTimestamp(loginTs);
          widgetService.startAutoUpdate();
        });

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
              });
            } else {
              import('../../../services/widgetService').then(({ widgetService }) => {
                widgetService.startAutoUpdate();
              });
            }
          });
        }).catch(async () => {
          // Token is invalid/expired — log out silently
          await get().logout();
        });
      },

      // ── Logout ──────────────────────────────────────────────────────────────
      logout: async () => {
        try {
          await clearFcmToken();
          await authService.logout();
        } catch {
          /* silent */
        }
        await tokenService.clear();

        // Stop widget background updates and clear login timestamp
        import('../../../services/widgetService').then(({ widgetService }) => {
          widgetService.stopAutoUpdate();
          widgetService.clearLoginTimestamp();
        });

        // Clear user-specific stores to prevent data leakage between accounts
        const { useGamificationStore } = await import('../../health/store/gamificationStore');
        const { useHydrationStore } = await import('../../health/store/hydrationStore');
        const { useHealthDataStore } = await import('../../health/store/healthDataStore');

        useGamificationStore.getState().reset();
        useHydrationStore.getState().reset();
        useHealthDataStore.getState().reset();

        set(state => {
          state.user = null;
          state.accessToken = null;
          state.isAuthenticated = false;
        });
      },

      // ── Partial user update (e.g. after edit profile) ───────────────────────
      updateUser: (partial: Partial<User>) => {
        set(state => {
          if (state.user) Object.assign(state.user, partial);
        });
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
