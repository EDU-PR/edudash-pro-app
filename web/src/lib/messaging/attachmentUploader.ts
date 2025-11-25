import { createClient } from '@/lib/supabase/client';

const BUCKET_NAME = 'dash-attachments';

export interface UploadResult {
  url: string;
  path: string;
  mimeType: string;
}

interface UploadOptions {
  pathPrefix?: string;
  filenameHint?: string;
  contentType?: string;
}

const getExtension = (input?: string) => {
  if (!input) return undefined;
  const clean = input.split('.').pop()?.toLowerCase();
  return clean?.replace(/[^a-z0-9]/g, '') || undefined;
};

export const uploadMessageAttachment = async (
  file: File | Blob,
  options: UploadOptions = {}
): Promise<UploadResult> => {
  const supabase = createClient();
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const fallbackExt = getExtension(options.filenameHint) || (file instanceof File ? getExtension(file.name) : undefined) || 'bin';
  const contentType = options.contentType || (file instanceof File ? file.type : undefined) || 'application/octet-stream';
  const objectPath = `${options.pathPrefix ? `${options.pathPrefix}/` : ''}${timestamp}_${random}.${fallbackExt}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(objectPath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(objectPath);

  return {
    url: data.publicUrl,
    path: objectPath,
    mimeType: contentType,
  };
};
