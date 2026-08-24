
import { tokenService } from '../features/auth/service/tokenService';
import { useAuthStore } from '../features/auth/store/authStore';
import { useSystemStore } from '../store/systemStore';
import { useNetworkStore } from '../store/networkStore';
import { useSyncStore } from '../store/syncStore';
import { isLoggingOut, setIsLoggingOut } from './logoutGuard';
import { CONFIG } from '../config/appConfig';
import { getDeviceHeaders } from './deviceInfo';
import { handleStepTrackingError } from '../services/stepTrackingGate';
import { recordError } from '../services/crashReporting';

export const BASE_URL = CONFIG.BASE_URL

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestOptions extends RequestInit {
  auth?: boolean;
  retry?: boolean;
}

interface ApiError {
  message: string;
  statusCode: number;
  data?: any;
  /** Stable machine-readable failure identifier, e.g. 'STEPS_TRACKING_DISABLED'. */
  code?: string | null;
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

  // Track sync state for the global sync indicator (only for primary requests,
  // not retries — avoids double-counting after token refresh).
  if (!retry) {
    useSyncStore.getState().startSync();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // App build + device identity on every request. The backend records this
    // against the user (deviceContext.middleware) so a bug report can be tied
    // to the build that produced it — without it there is no way to tell
    // whether a user has installed a released fix. Spread before the caller's
    // own headers so an explicit override still wins.
    ...getDeviceHeaders('app'),
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
    // End sync tracking on network failure
    if (!retry) {
      useSyncStore.getState().endSync();
    }

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
    // End sync tracking — the retry (if any) won't double-count
    useSyncStore.getState().endSync();

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
    if (!retry) { useSyncStore.getState().endSync(); }
    useSystemStore.getState().setMaintenance(true);
    throw createError('Service is under maintenance.', 503);
  }

  // ── Parse response ─────────────────────────────────────────────────────────
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (!retry) { useSyncStore.getState().endSync(); }

    // Step tracking switched off for this account by an admin. Handled here
    // rather than at each call site so a rejection on ANY endpoint — not just
    // /health/sync — stops the native step service and surfaces the warning.
    handleStepTrackingError(json);

    const err = createError(json?.message ?? 'Something went wrong', response.status);
    err.data = json?.data ?? null;
    err.code = json?.code ?? null;

    // Report server faults only. 4xx responses are the API working as designed
    // — validation, auth, the step gates above — and recording them would bury
    // the real signal. A 5xx is a backend bug the user just hit, and nothing
    // else currently tells us it happened.
    if (response.status >= 500) {
      recordError(err, 'apiServerError', {
        endpoint,
        status: response.status,
      });
    }

    throw err;
  }

  // Success — end sync tracking
  if (!retry) { useSyncStore.getState().endSync(); }
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
