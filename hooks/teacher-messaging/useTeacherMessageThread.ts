/**
 * Teacher Message Thread — Orchestrator Hook
 * Composes state and handler sub-hooks for the teacher message thread screen.
 */
import { useMessageThreadState } from './useMessageThreadState';
import { useMessageThreadHandlers } from './useMessageThreadHandlers';

export type { ChatRow } from './useMessageThreadState';

export function useTeacherMessageThread() {
  const state = useMessageThreadState();
  const handlers = useMessageThreadHandlers(state);
  return { ...state, ...handlers };
}
