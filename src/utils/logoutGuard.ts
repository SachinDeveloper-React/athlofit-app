// Shared flag that prevents re-entrant logout/refresh loops.
// Lives in its own module so api.ts and authStore.ts can both import it
// without creating a circular dependency.

let _isLoggingOut = false;

export function isLoggingOut(): boolean {
  return _isLoggingOut;
}

export function setIsLoggingOut(value: boolean): void {
  _isLoggingOut = value;
}
