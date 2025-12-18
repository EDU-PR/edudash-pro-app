import React, { createContext, useContext, useMemo } from 'react';

interface VoiceUIOpenOptions {
  language?: string;
  forceMode?: 'streaming' | 'batch';
}

interface VoiceUIController {
  open: (options?: VoiceUIOpenOptions) => Promise<void>;
}

const VoiceUIContext = createContext<VoiceUIController | null>(null);

/**
 * Minimal Voice UI controller.
 *
 * The full voice UI implementation is platform/feature dependent; this controller exists so
 * the rest of the app can compile and safely call `open()` without crashing when voice UI
 * is not wired up in the current build.
 */
export function VoiceUIProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<VoiceUIController>(() => {
    return {
      open: async (_options?: VoiceUIOpenOptions) => {
        // no-op fallback
      },
    };
  }, []);

  return <VoiceUIContext.Provider value={value}>{children}</VoiceUIContext.Provider>;
}

export function useVoiceUI(): VoiceUIController {
  const ctx = useContext(VoiceUIContext);
  if (ctx) return ctx;
  // Safe fallback when provider isn't mounted
  return {
    open: async (_options?: VoiceUIOpenOptions) => {
      // no-op
    },
  };
}



