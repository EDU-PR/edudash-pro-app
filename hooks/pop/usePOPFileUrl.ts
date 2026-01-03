/**
 * usePOPFileUrl Hook
 * Gets signed URL for viewing POP files
 */
import { useQuery } from '@tanstack/react-query';
import { getPOPFileUrl } from '@/lib/popUpload';
import { POP_QUERY_KEYS } from './queryKeys';
import type { POPUpload } from './types';

export const usePOPFileUrl = (upload: POPUpload | null) => {
  return useQuery({
    queryKey: upload?.id ? POP_QUERY_KEYS.fileUrl(upload.id) : ['pop_file_url', 'none'],
    queryFn: async (): Promise<string | null> => {
      if (!upload) return null;
      
      return await getPOPFileUrl(
        upload.upload_type,
        upload.file_path,
        3600 // 1 hour expiry
      );
    },
    enabled: !!upload,
    staleTime: 1800000, // 30 minutes
    refetchOnWindowFocus: false,
  });
};
