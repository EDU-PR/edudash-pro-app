/**
 * Types for Thread Options
 * Extracted from hooks/useThreadOptions.ts
 */

import type { Message } from '@/components/messaging';

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'other';

export interface UseThreadOptionsProps {
  threadId: string;
  userId?: string;
  /** The other participant's user ID (for DMs) */
  otherUserId?: string;
  /** School context for reports / blocks */
  schoolId?: string;
  refetch: () => void;
  setShowOptionsMenu: (show: boolean) => void;
  setOptimisticMsgs: React.Dispatch<React.SetStateAction<Message[]>>;
  displayName: string;
}

export interface ThreadSettingsState {
  isMuted: boolean;
  isUserBlocked: boolean;
  disappearAfterSeconds: number | null;
  inferredOtherUserId: string | null;
}
