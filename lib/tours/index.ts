/**
 * Tour Registry
 *
 * Central list of all available spotlight tours.
 * Import this in SpotlightTourProvider to make tours available.
 *
 * @module lib/tours/index
 */

import { parentMenuTour } from './parentMenuTour';
import type { TourConfig } from '@/components/ui/SpotlightTour/types';

/**
 * All registered tours. Add new TourConfig entries here.
 * The SpotlightTourProvider will auto-trigger eligible tours
 * based on user role and version.
 */
export const allTours: TourConfig[] = [
  parentMenuTour,
];

export { parentMenuTour };
