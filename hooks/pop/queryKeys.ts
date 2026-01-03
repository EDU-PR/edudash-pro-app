/**
 * POP Query Keys
 * Centralized React Query keys for POP uploads
 */

export const POP_QUERY_KEYS = {
  all: ['pop_uploads'] as const,
  lists: () => [...POP_QUERY_KEYS.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...POP_QUERY_KEYS.lists(), filters] as const,
  details: () => [...POP_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...POP_QUERY_KEYS.details(), id] as const,
  stats: () => [...POP_QUERY_KEYS.all, 'stats'] as const,
  studentStats: (studentId: string) => [...POP_QUERY_KEYS.stats(), studentId] as const,
  fileUrl: (uploadId: string) => ['pop_file_url', uploadId] as const,
};
