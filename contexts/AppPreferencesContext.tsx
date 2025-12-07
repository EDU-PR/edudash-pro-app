/**
 * App Preferences Context
 * 
 * Manages user preferences for UI elements:
 * - FAB visibility and position
 * - Tutorial/onboarding state
 * - Bottom nav auto-hide preference
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  SHOW_DASH_FAB: '@app_prefs:show_dash_fab',
  FAB_POSITION: '@app_prefs:fab_position',
  TUTORIAL_COMPLETED: '@app_prefs:tutorial_completed',
  BOTTOM_NAV_AUTO_HIDE: '@app_prefs:bottom_nav_auto_hide',
};

interface FABPosition {
  x: number;
  y: number;
}

interface AppPreferencesState {
  showDashFAB: boolean;
  fabPosition: FABPosition | null; // null = use default
  tutorialCompleted: boolean;
  bottomNavAutoHide: boolean;
  isLoaded: boolean;
}

interface AppPreferencesContextValue extends AppPreferencesState {
  setShowDashFAB: (visible: boolean) => void;
  setFabPosition: (position: FABPosition | null) => void;
  setTutorialCompleted: (completed: boolean) => void;
  setBottomNavAutoHide: (autoHide: boolean) => void;
  resetTutorial: () => void;
  resetFabPosition: () => void;
}

const AppPreferencesContext = createContext<AppPreferencesContextValue | undefined>(undefined);

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppPreferencesState>({
    showDashFAB: true,
    fabPosition: null,
    tutorialCompleted: false,
    bottomNavAutoHide: true, // Default to auto-hide
    isLoaded: false,
  });

  // Load preferences from storage on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const [showDashFAB, fabPosition, tutorialCompleted, bottomNavAutoHide] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.SHOW_DASH_FAB),
          AsyncStorage.getItem(STORAGE_KEYS.FAB_POSITION),
          AsyncStorage.getItem(STORAGE_KEYS.TUTORIAL_COMPLETED),
          AsyncStorage.getItem(STORAGE_KEYS.BOTTOM_NAV_AUTO_HIDE),
        ]);

        setState({
          showDashFAB: showDashFAB !== 'false', // Default true
          fabPosition: fabPosition ? JSON.parse(fabPosition) : null,
          tutorialCompleted: tutorialCompleted === 'true',
          bottomNavAutoHide: bottomNavAutoHide !== 'false', // Default true
          isLoaded: true,
        });
      } catch (error) {
        console.warn('[AppPreferences] Failed to load preferences:', error);
        setState(prev => ({ ...prev, isLoaded: true }));
      }
    };

    loadPreferences();
  }, []);

  const setShowDashFAB = useCallback(async (visible: boolean) => {
    setState(prev => ({ ...prev, showDashFAB: visible }));
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SHOW_DASH_FAB, String(visible));
    } catch (error) {
      console.warn('[AppPreferences] Failed to save FAB visibility:', error);
    }
  }, []);

  const setFabPosition = useCallback(async (position: FABPosition | null) => {
    setState(prev => ({ ...prev, fabPosition: position }));
    try {
      if (position) {
        await AsyncStorage.setItem(STORAGE_KEYS.FAB_POSITION, JSON.stringify(position));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.FAB_POSITION);
      }
    } catch (error) {
      console.warn('[AppPreferences] Failed to save FAB position:', error);
    }
  }, []);

  const setTutorialCompleted = useCallback(async (completed: boolean) => {
    setState(prev => ({ ...prev, tutorialCompleted: completed }));
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TUTORIAL_COMPLETED, String(completed));
    } catch (error) {
      console.warn('[AppPreferences] Failed to save tutorial state:', error);
    }
  }, []);

  const setBottomNavAutoHide = useCallback(async (autoHide: boolean) => {
    setState(prev => ({ ...prev, bottomNavAutoHide: autoHide }));
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.BOTTOM_NAV_AUTO_HIDE, String(autoHide));
    } catch (error) {
      console.warn('[AppPreferences] Failed to save bottom nav preference:', error);
    }
  }, []);

  const resetTutorial = useCallback(() => {
    setTutorialCompleted(false);
  }, [setTutorialCompleted]);

  const resetFabPosition = useCallback(() => {
    setFabPosition(null);
  }, [setFabPosition]);

  return (
    <AppPreferencesContext.Provider
      value={{
        ...state,
        setShowDashFAB,
        setFabPosition,
        setTutorialCompleted,
        setBottomNavAutoHide,
        resetTutorial,
        resetFabPosition,
      }}
    >
      {children}
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences() {
  const context = useContext(AppPreferencesContext);
  if (!context) {
    throw new Error('useAppPreferences must be used within an AppPreferencesProvider');
  }
  return context;
}

// Safe hook that returns defaults if provider not available
export function useAppPreferencesSafe() {
  try {
    return useAppPreferences();
  } catch {
    return {
      showDashFAB: true,
      fabPosition: null,
      tutorialCompleted: true,
      bottomNavAutoHide: true,
      isLoaded: true,
      setShowDashFAB: () => {},
      setFabPosition: () => {},
      setTutorialCompleted: () => {},
      setBottomNavAutoHide: () => {},
      resetTutorial: () => {},
      resetFabPosition: () => {},
    };
  }
}
