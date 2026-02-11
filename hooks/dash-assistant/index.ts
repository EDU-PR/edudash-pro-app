/**
 * useDashAssistant — Orchestrator
 *
 * Thin composition layer that wires all sub-hooks together.
 * Business logic lives in the sub-modules — this file only
 * calls them and returns the unified public API.
 *
 * Pattern follows hooks/principal-hub/index.ts.
 *
 * @module hooks/dash-assistant/index
 * @max-lines 200
 */

export { useDashAssistant } from './useDashAssistantCore';
