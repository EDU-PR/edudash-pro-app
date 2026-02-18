/**
 * DashOrb — Unified orb visual for all roles.
 *
 * Wraps CosmicOrb (the canonical Dash visual) so that every consumer
 * gets the same cosmic-nebula design used across the app.
 *
 * For an interactive AI entry point, use the global DraggableDashFAB
 * (rendered in app/_layout.tsx).  This component is presentational only.
 */

import React from 'react';
import { CosmicOrb } from '@/components/dash-orb/CosmicOrb';

export interface DashOrbProps {
  /** Outer diameter in pixels (default 64) */
  size?: number;
  /** Forward animation state when embedded near voice input */
  isProcessing?: boolean;
  /** Forward speaking state for amplitude reactivity */
  isSpeaking?: boolean;
}

export default function DashOrb({
  size = 64,
  isProcessing = false,
  isSpeaking = false,
}: DashOrbProps) {
  return (
    <CosmicOrb size={size} isProcessing={isProcessing} isSpeaking={isSpeaking} />
  );
}
