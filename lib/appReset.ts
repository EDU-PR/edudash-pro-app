let resetHandler: (() => void) | null = null;

export function registerAppResetHandler(handler: () => void) {
  resetHandler = handler;
  return () => {
    if (resetHandler === handler) {
      resetHandler = null;
    }
  };
}

export function requestAppReset() {
  if (resetHandler) {
    resetHandler();
    return true;
  }
  if (__DEV__) {
    console.warn('[AppReset] No reset handler registered');
  }
  return false;
}
