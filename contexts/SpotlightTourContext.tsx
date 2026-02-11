/**
 * SpotlightTourContext
 *
 * Provider that manages spotlight tours: persists completion state,
 * orchestrates step progression, measures target refs, and renders
 * the overlay + tooltip. Wrap your app root with <SpotlightTourProvider>.
 *
 * Tours auto-trigger when their version is higher than the user's
 * last-completed version, and only for matching roles.
 *
 * @module contexts/SpotlightTourContext
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Modal, StatusBar, View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SpotlightOverlay } from '@/components/ui/SpotlightTour/SpotlightOverlay';
import { SpotlightTooltip } from '@/components/ui/SpotlightTour/SpotlightTooltip';
import type {
  SpotlightTourContextValue,
  TourConfig,
  TourState,
  TargetMeasurement,
} from '@/components/ui/SpotlightTour/types';

const STORAGE_PREFIX = 'tour:state:';

const SpotlightTourCtx = createContext<SpotlightTourContextValue>({
  registerTarget: () => {},
  unregisterTarget: () => {},
  startTour: () => {},
  endTour: () => {},
  isActive: false,
  activeTourId: null,
  currentStep: 0,
});

export const useSpotlightTour = () => useContext(SpotlightTourCtx);

interface Props {
  /** All available tour configs */
  tours: TourConfig[];
  /** Current user role (used to filter tours) */
  userRole?: string;
  children: React.ReactNode;
}

export const SpotlightTourProvider: React.FC<Props> = ({
  tours,
  userRole,
  children,
}) => {
  const targetRefs = useRef<Map<string, React.RefObject<any>>>(new Map());
  const [activeTour, setActiveTour] = useState<TourConfig | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetMeasurement, setTargetMeasurement] =
    useState<TargetMeasurement | null>(null);

  // ---- Registration ----
  const registerTarget = useCallback(
    (key: string, ref: React.RefObject<any>) => {
      targetRefs.current.set(key, ref);
    },
    [],
  );
  const unregisterTarget = useCallback((key: string) => {
    targetRefs.current.delete(key);
  }, []);

  // ---- Persistence ----
  const getTourState = useCallback(
    async (tourId: string): Promise<TourState | null> => {
      try {
        const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${tourId}`);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    [],
  );

  const saveTourState = useCallback(
    async (tourId: string, version: number) => {
      try {
        const state: TourState = {
          completedVersion: version,
          completedAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem(
          `${STORAGE_PREFIX}${tourId}`,
          JSON.stringify(state),
        );
      } catch {
        // Silently fail — non-critical
      }
    },
    [],
  );

  // ---- Measure target ----
  const measureTarget = useCallback((stepKey: string) => {
    const ref = targetRefs.current.get(stepKey);
    if (!ref?.current?.measureInWindow) {
      setTargetMeasurement(null);
      return;
    }
    ref.current.measureInWindow(
      (x: number, y: number, width: number, height: number) => {
        if (width > 0 && height > 0) {
          setTargetMeasurement({ x, y, width, height });
        } else {
          setTargetMeasurement(null);
        }
      },
    );
  }, []);

  // ---- Tour lifecycle ----
  const startTour = useCallback(
    (tourId: string) => {
      const tour = tours.find((t) => t.id === tourId);
      if (!tour || tour.steps.length === 0) return;
      setActiveTour(tour);
      setCurrentStep(0);
      // Measure after a short delay so targets are rendered
      setTimeout(() => measureTarget(tour.steps[0].targetKey), 350);
    },
    [tours, measureTarget],
  );

  const endTour = useCallback(() => {
    if (activeTour) {
      saveTourState(activeTour.id, activeTour.version);
    }
    setActiveTour(null);
    setCurrentStep(0);
    setTargetMeasurement(null);
  }, [activeTour, saveTourState]);

  const nextStep = useCallback(() => {
    if (!activeTour) return;
    const next = currentStep + 1;
    if (next >= activeTour.steps.length) {
      endTour();
      return;
    }
    setCurrentStep(next);
    setTimeout(() => measureTarget(activeTour.steps[next].targetKey), 250);
  }, [activeTour, currentStep, endTour, measureTarget]);

  // ---- Auto-trigger tours ----
  useEffect(() => {
    if (activeTour) return; // Don't auto-trigger if one is already active
    const autoCheck = async () => {
      for (const tour of tours) {
        // Role filter
        if (tour.roles && tour.roles.length > 0 && userRole) {
          if (!tour.roles.includes(userRole)) continue;
        }
        const state = await getTourState(tour.id);
        if (!state || state.completedVersion < tour.version) {
          // Check if targets are registered
          const firstKey = tour.steps[0]?.targetKey;
          if (firstKey && targetRefs.current.has(firstKey)) {
            startTour(tour.id);
            break;
          }
        }
      }
    };
    // Delay to let screen render and register targets
    const timer = setTimeout(autoCheck, 1500);
    return () => clearTimeout(timer);
    // Only re-run when tours or role change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tours, userRole]);

  // ---- Context value ----
  const value = useMemo<SpotlightTourContextValue>(
    () => ({
      registerTarget,
      unregisterTarget,
      startTour,
      endTour,
      isActive: !!activeTour,
      activeTourId: activeTour?.id ?? null,
      currentStep,
    }),
    [registerTarget, unregisterTarget, startTour, endTour, activeTour, currentStep],
  );

  const activeStep = activeTour?.steps[currentStep] ?? null;

  return (
    <SpotlightTourCtx.Provider value={value}>
      {children}

      {/* Tour overlay rendered as a modal so it sits above everything */}
      <Modal
        visible={!!activeTour && !!activeStep}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={endTour}
      >
        <StatusBar backgroundColor="transparent" translucent />
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <SpotlightOverlay
            visible={!!activeStep}
            target={targetMeasurement}
            shape={activeStep?.spotlightShape}
            padding={activeStep?.spotlightPadding}
            onPress={nextStep}
          />
          {activeStep && (
            <SpotlightTooltip
              step={activeStep}
              target={targetMeasurement}
              stepIndex={currentStep}
              totalSteps={activeTour?.steps.length ?? 0}
              onNext={nextStep}
              onSkip={endTour}
              onDone={endTour}
            />
          )}
        </View>
      </Modal>
    </SpotlightTourCtx.Provider>
  );
};

export default SpotlightTourProvider;
