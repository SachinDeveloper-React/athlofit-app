// src/features/auth/service/tokenService.ts
//
// Single source of truth for token storage.
// All reads/writes go through Keychain — never AsyncStorage.

import * as Keychain from 'react-native-keychain';
import type { AuthTokens } from '../../../types/auth.types';

const SERVICE_ACCESS = 'com.healthapp.accessToken';
const SERVICE_REFRESH = 'com.healthapp.refreshToken';

// ─── Save ─────────────────────────────────────────────────────────────────────

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await Promise.all([
    Keychain.setGenericPassword('accessToken', tokens.accessToken, {
      service: SERVICE_ACCESS,
    }),
    Keychain.setGenericPassword('refreshToken', tokens.refreshToken, {
      service: SERVICE_REFRESH,
    }),
  ]);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getAccessToken(): Promise<string | null> {
  const creds = await Keychain.getGenericPassword({ service: SERVICE_ACCESS });
  return creds ? creds.password : null;
}

export async function getRefreshToken(): Promise<string | null> {
  const creds = await Keychain.getGenericPassword({ service: SERVICE_REFRESH });
  return creds ? creds.password : null;
}

export async function getTokens(): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  const [access, refresh] = await Promise.all([
    getAccessToken(),
    getRefreshToken(),
  ]);
  if (!access || !refresh) return null;
  return { accessToken: access, refreshToken: refresh };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function clearTokens(): Promise<void> {
  await Promise.all([
    Keychain.resetGenericPassword({ service: SERVICE_ACCESS }),
    Keychain.resetGenericPassword({ service: SERVICE_REFRESH }),
  ]);
}

// ─── JWT helpers ──────────────────────────────────────────────────────────────

export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(token.split('.')[1]);
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

// ─── Named export for consistent imports ─────────────────────────────────────

export const tokenService = {
  save: saveTokens,
  getAccessToken,
  getRefreshToken,
  getTokens,
  clear: clearTokens,
  isExpired: isTokenExpired,
};
