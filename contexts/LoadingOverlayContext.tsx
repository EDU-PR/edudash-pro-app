import React, { createContext, useContext, useMemo, useState } from 'react';

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

export function LoadingOverlayProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LoadingOverlayState>({ visible: false });

  const value = useMemo<LoadingOverlayContextValue>(() => ({
    visible: state.visible,
    message: state.message,
    show: (message?: string) => setState({ visible: true, message }),
    hide: () => setState({ visible: false }),
    setMessage: (message?: string) => setState((prev) => ({ ...prev, message })),
  }), [state.message, state.visible]);

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
