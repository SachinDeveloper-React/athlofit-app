// src/utils/api.ts
//
// Thin fetch wrapper — attaches Bearer token, handles 401 refresh,
// and normalises errors. No axios dependency.

import { tokenService } from '../features/auth/service/tokenService';
import { useAuthStore } from '../features/auth/store/authStore';
import { useSystemStore } from '../store/systemStore';
import { useNetworkStore } from '../store/networkStore';
import { isLoggingOut, setIsLoggingOut } from './logoutGuard';

// BUG-044: Read BASE_URL from env variable with platform-aware localhost fallback.
// Never hardcode the production URL — developers hitting prod from local is dangerous.
// export const BASE_URL =
//   process.env.REACT_APP_API_URL ??
//   (Platform.OS === 'android'
//     ? 'http://192.168.0.129:5001/'
//     : 'http://localhost:5001/');
// export const BASE_URL = 'http://192.168.0.129:5001/'

export const BASE_URL = 'https://api.athlofit.com/'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestOptions extends RequestInit {
  auth?: boolean;
  retry?: boolean;
}

interface ApiError {
  message: string;
  statusCode: number;
  data?: any;
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

// Mutex: ensures only one token refresh runs at a time.
// All concurrent 401s wait for the same refresh and reuse its result.
let refreshPromise: Promise<boolean> | null = null;

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { auth = true, retry = false, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((fetchOptions.headers as Record<string, string>) ?? {}),
  };

  // Attach access token
  if (auth) {
    const token = await tokenService.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
    });
    // Server responded — clear any previous unreachable flag
    useSystemStore.getState().setServerUnreachable(false);
  } catch (err: any) {
    // fetch() throws a TypeError when the network request fails entirely
    // (no DNS, connection refused, server down, etc.)
    const isNetworkError =
      err instanceof TypeError ||
      err?.message === 'Network request failed' ||
      err?.message?.includes('Network request failed') ||
      err?.message?.includes('Failed to fetch');

    if (isNetworkError) {
      // Only show the server-unreachable modal if the device is online.
      // When offline, the offline mode handles this gracefully (queuing, banners, etc.)
      const isOnline = useNetworkStore.getState().isOnline;
      if (isOnline) {
        useSystemStore.getState().setServerUnreachable(true);
      }
    }
    throw err;
  }

  // ── 401: attempt token refresh ─────────────────────────────────────────────
  if (response.status === 401 && !retry) {
    // If logout is in progress, don't trigger another logout — just throw
    if (isLoggingOut()) {
      throw createError('Session expired. Please log in again.', 401);
    }

    // Mutex: if a refresh is already in flight, wait for it instead of
    // firing a second one. This prevents concurrent 401s from each calling
    // tryRefresh(), which causes multiple token rotations and revokes all tokens.
    if (!refreshPromise) {
      refreshPromise = tryRefresh().finally(() => {
        refreshPromise = null;
      });
    }
    const refreshed = await refreshPromise;

    // BUG-045: If the user logged out while the refresh was in flight,
    // don't re-authenticate them by retrying the original request.
    if (refreshed && !isLoggingOut()) {
      return request<T>(endpoint, { ...options, retry: true });
    } else if (refreshed && isLoggingOut()) {
      throw createError('Session expired. Please log in again.', 401);
    } else {
      // Refresh failed — full logout so the user lands on the sign-in screen
      setIsLoggingOut(true);
      try {
        await useAuthStore.getState().logout();
      } finally {
        setIsLoggingOut(false);
      }
      throw createError('Session expired. Please log in again.', 401);
    }
  }

  // ── 503: Maintenance mode ──────────────────────────────────────────────────
  if (response.status === 503) {
    useSystemStore.getState().setMaintenance(true);
    throw createError('Service is under maintenance.', 503);
  }

  // ── Parse response ─────────────────────────────────────────────────────────
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = createError(json?.message ?? 'Something went wrong', response.status);
    err.data = json?.data ?? null;
    throw err;
  }

  return json as T;
}

// ─── Token refresh ────────────────────────────────────────────────────────────

async function tryRefresh(): Promise<boolean> {
  try {
    const refreshToken = await tokenService.getRefreshToken();
    if (!refreshToken) return false;

    const res = await fetch(`${BASE_URL}auth/user/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    const newAccessToken: string = data?.data?.accessToken;
    const newRefreshToken: string = data?.data?.refreshToken;

    // BUG-046: Validate tokens are non-empty before saving — a null/empty token
    // would overwrite valid stored tokens and silently break the session.
    if (!newAccessToken || !newRefreshToken) return false;

    await tokenService.save({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
    useAuthStore.getState().setAccessToken(newAccessToken);

    // Keep the native-side mirror in sync so EodSyncWorker always has a
    // valid token even after a silent refresh while the app is in background.
    if (newAccessToken) {
      import('../services/widgetService').then(({ widgetService }) => {
        widgetService.saveAccessToken(newAccessToken);
      }).catch(() => {});
    }

    return true;
  } catch {
    return false;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createError(message: string, statusCode: number): ApiError & Error {
  const err = new Error(message) as ApiError & Error;
  err.message = message;
  err.statusCode = statusCode;
  return err;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const api = {
  get: <T>(url: string, opts?: RequestOptions) =>
    request<T>(url, { ...opts, method: 'GET' }),

  post: <T>(url: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(url, { ...opts, method: 'POST', body: JSON.stringify(body) }),

  put: <T>(url: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(url, { ...opts, method: 'PUT', body: JSON.stringify(body) }),

  patch: <T>(url: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(url, { ...opts, method: 'PATCH', body: JSON.stringify(body) }),

  delete: <T>(url: string, opts?: RequestOptions) =>
    request<T>(url, { ...opts, method: 'DELETE' }),
};
