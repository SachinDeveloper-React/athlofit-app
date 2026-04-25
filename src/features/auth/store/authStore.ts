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
        // Register FCM token now that we have a session
        import('../../../services/fcmService').then(({ registerFcmToken }) =>
          registerFcmToken(),
        );
      },

      // ── Called on app launch — restore session from Keychain ────────────────
      setTokensFromStorage: async () => {
        const tokens = await tokenService.getTokens();
        if (!tokens) return;

        // Optionally verify token hasn't expired
        // if (tokenService.isExpired(tokens.accessToken)) {
        //   // await get().logout();
        //   return;
        // }

        // Fetch current user profile
        try {
          const res = await authService.me();
          console.log("me", res);

          set(state => {
            state.user = res.data;
            state.isAuthenticated = true;
          });
        } catch {
          await get().logout();
        }
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
