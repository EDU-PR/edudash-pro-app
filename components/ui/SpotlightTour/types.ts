/**
 * SpotlightTour Type Definitions
 *
 * Shared types for the spotlight tour system — a dark-overlay + cutout
 * guided feature tour triggered automatically on new features.
 */

import type { ViewStyle } from 'react-native';

/** Position measurements of a spotlight target element */
export interface TargetMeasurement {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A single step in a spotlight tour */
export interface TourStep {
  /** Unique key — also used as the target ref identifier */
  targetKey: string;
  /** Title shown in the tooltip */
  title: string;
  /** Description text shown below the title */
  description: string;
  /** Icon name from Ionicons (optional) */
  icon?: string;
  /** Preferred tooltip position relative to the spotlight cutout */
  tooltipPosition?: 'above' | 'below' | 'auto';
  /** Shape of the spotlight cutout */
  spotlightShape?: 'rectangle' | 'circle';
  /** Extra padding around the target element */
  spotlightPadding?: number;
}

/** Full tour configuration */
export interface TourConfig {
  /** Unique tour ID — used for AsyncStorage persistence */
  id: string;
  /** Semantic version — bumping triggers re-show for returning users */
  version: number;
  /** Steps in display order */
  steps: TourStep[];
  /** Which user roles can see this tour (empty = all) */
  roles?: string[];
  /** Minimum app version required (semver string, optional) */
  minAppVersion?: string;
}

/** Tour completion state persisted in AsyncStorage */
export interface TourState {
  completedVersion: number;
  completedAt: string;
}

/** Shape of the context value provided by SpotlightTourProvider */
export interface SpotlightTourContextValue {
  /** Register a target element ref by key */
  registerTarget: (key: string, ref: React.RefObject<any>) => void;
  /** Unregister a target element ref */
  unregisterTarget: (key: string) => void;
  /** Manually start a tour by ID */
  startTour: (tourId: string) => void;
  /** End the current tour */
  endTour: () => void;
  /** Whether a tour is currently active */
  isActive: boolean;
  /** ID of the active tour (null if none) */
  activeTourId: string | null;
  /** Current step index */
  currentStep: number;
}

/** Props for the spotlight overlay component */
export interface SpotlightOverlayProps {
  /** Target measurement for the cutout */
  target: TargetMeasurement | null;
  /** Whether to show the overlay */
  visible: boolean;
  /** Cutout shape */
  shape?: 'rectangle' | 'circle';
  /** Extra padding around the cutout */
  padding?: number;
  /** Overlay opacity (0-1) */
  overlayOpacity?: number;
  /** Style overrides */
  style?: ViewStyle;
}

/** Props for the tooltip component */
export interface SpotlightTooltipProps {
  /** Current step data */
  step: TourStep;
  /** Target measurement (positions the tooltip) */
  target: TargetMeasurement | null;
  /** Current step number (0-indexed) */
  stepIndex: number;
  /** Total number of steps */
  totalSteps: number;
  /** Called when user taps Next */
  onNext: () => void;
  /** Called when user taps Skip */
  onSkip: () => void;
  /** Called when user taps Done (last step) */
  onDone: () => void;
}
