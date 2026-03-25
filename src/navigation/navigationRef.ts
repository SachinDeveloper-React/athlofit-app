// src/navigation/navigationRef.ts
//
// Allows navigation from outside React components —
// e.g. inside authService, tokenService, or Axios interceptors.

import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation.types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Navigate from anywhere outside a component.
 *
 * Usage:
 *   import { navigate } from '@navigation/navigationRef';
 *   navigate('AuthStack', { screen: 'Login' });
 */
export function navigate<T extends keyof RootStackParamList>(
  name: T,
  params?: RootStackParamList[T],
): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as any, params as any);
  }
}

/**
 * Replace current screen from anywhere outside a component.
 * Use this after login to clear the auth stack.
 */
export function replace<T extends keyof RootStackParamList>(
  name: T,
  params?: RootStackParamList[T],
): void {
  if (navigationRef.isReady()) {
    navigationRef.dispatch({
      type: 'REPLACE',
      payload: { name, params },
    });
  }
}

/** Reset the entire navigation stack. Useful on logout. */
export function resetToAuth(): void {
  if (navigationRef.isReady()) {
    navigationRef.reset({
      index: 0,
      routes: [{ name: 'AuthStack', params: { screen: 'Login' } }],
    });
  }
}

/** Get the current active route name. */
export function getCurrentRoute(): string | undefined {
  return navigationRef.getCurrentRoute()?.name;
}
