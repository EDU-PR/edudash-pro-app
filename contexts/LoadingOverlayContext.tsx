import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

type LoadingOverlayState = {
  visible: boolean;
  message?: string;
};

type LoadingOverlayContextValue = LoadingOverlayState & {
  show: (message?: string) => void;
  hide: () => void;
  setMessage: (message?: string) => void;
};

const LoadingOverlayContext = createContext<LoadingOverlayContextValue | null>(null);

// ── Module-level imperative API ─────────────────────────────
// Allows code outside the React tree (e.g. AuthContext handlers
// that mount ABOVE LoadingOverlayProvider) to show/hide the overlay.
let _imperativeShow: ((message?: string) => void) | null = null;
let _imperativeHide: (() => void) | null = null;

/** Show the global loading overlay imperatively (safe no-op if provider not mounted). */
export function showLoadingOverlay(message?: string): void {
  _imperativeShow?.(message);
}

/** Hide the global loading overlay imperatively (safe no-op if provider not mounted). */
export function hideLoadingOverlay(): void {
  _imperativeHide?.();
}

export function LoadingOverlayProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LoadingOverlayState>({ visible: false });

  const showFn = useMemo(() => (message?: string) => setState({ visible: true, message }), []);
  const hideFn = useMemo(() => () => setState({ visible: false }), []);

  // Register imperative refs on mount, clean up on unmount
  useEffect(() => {
    _imperativeShow = showFn;
    _imperativeHide = hideFn;
    return () => {
      _imperativeShow = null;
      _imperativeHide = null;
    };
  }, [showFn, hideFn]);

  const value = useMemo<LoadingOverlayContextValue>(() => ({
    visible: state.visible,
    message: state.message,
    show: showFn,
    hide: hideFn,
    setMessage: (message?: string) => setState((prev) => ({ ...prev, message })),
  }), [state.message, state.visible, showFn, hideFn]);

  return (
    <LoadingOverlayContext.Provider value={value}>
      {children}
    </LoadingOverlayContext.Provider>
  );
}

export function useLoadingOverlay() {
  const context = useContext(LoadingOverlayContext);
  if (!context) {
    throw new Error('useLoadingOverlay must be used within LoadingOverlayProvider');
  }
  return context;
}
