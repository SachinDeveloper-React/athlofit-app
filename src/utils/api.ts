// src/utils/api.ts
//
// Thin fetch wrapper — attaches Bearer token, handles 401 refresh,
// and normalises errors. No axios dependency.

import { tokenService } from '../features/auth/service/tokenService';
import { useAuthStore } from '../features/auth/store/authStore';
import { resetToAuth } from '../navigation/navigationRef';

import { Platform } from 'react-native';

const BASE_URL =
  Platform.OS === 'android'
    ? 'http://192.168.0.129:5001/'
    // ? 'http://192.168.1.14:5001/'
    : 'http://localhost:5001/';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestOptions extends RequestInit {
  auth?: boolean; // default true — attach Bearer token
  retry?: boolean; // internal flag — prevents infinite refresh loop
}

interface ApiError {
  message: string;
  statusCode: number;
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

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
    console.log('Api Access Token', token);
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  // ── 401: attempt token refresh ─────────────────────────────────────────────
  if (response.status === 401 && !retry) {
    const refreshed = await tryRefresh();
    console.log("refreshed", refreshed)
    if (refreshed) {
      return request<T>(endpoint, { ...options, retry: true });
    } else {
      await tokenService.clear();
      resetToAuth();
      throw createError('Session expired. Please log in again.', 401);
    }
  }

  // ── Parse response ─────────────────────────────────────────────────────────
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw createError(json?.message ?? 'Something went wrong', response.status);
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
    console.log("refresh token data", data)
    await tokenService.save({
      accessToken: data?.data?.accessToken,
      refreshToken: data?.data?.refreshToken,
      expiresIn: 36000,
    });
    useAuthStore.getState().setAccessToken(data?.data?.accessToken);

    return true;
  } catch (error) {
    console.log("refresh token error", error)
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
