// Prefix guards ensure plain-text payloads never get parsed as structured media blocks
const MEDIA_PREFIX = '__media__';

export type MediaType = 'image' | 'audio' | 'file';

export interface MediaMessageContent {
  kind: 'media';
  mediaType: MediaType;
  url: string;
  name?: string;
  mimeType?: string;
  size?: number;
  durationMs?: number;
}

export interface TextMessageContent {
  kind: 'text';
  text: string;
}

export type RichMessageContent = MediaMessageContent | TextMessageContent;

export interface EncodeMediaOptions {
  mediaType: MediaType;
  url: string;
  name?: string;
  mimeType?: string;
  size?: number;
  durationMs?: number;
}

export const encodeMediaContent = (options: EncodeMediaOptions): string => {
  return `${MEDIA_PREFIX}${JSON.stringify(options)}`;
};

export const parseMessageContent = (rawContent: string): RichMessageContent => {
  if (typeof rawContent !== 'string') {
    return { kind: 'text', text: '' };
  }

  if (rawContent.startsWith(MEDIA_PREFIX)) {
    try {
      const parsed = JSON.parse(rawContent.slice(MEDIA_PREFIX.length));
      if (parsed && typeof parsed.url === 'string' && typeof parsed.mediaType === 'string') {
        return {
          kind: 'media',
          mediaType: parsed.mediaType,
          url: parsed.url,
          name: parsed.name,
          mimeType: parsed.mimeType,
          size: parsed.size,
          durationMs: parsed.durationMs,
        };
      }
    } catch (_err) {
      // Intentionally fallback to text rendering if parsing fails
    }
  }

  return { kind: 'text', text: rawContent };
};

export const isImageMedia = (content: RichMessageContent): content is MediaMessageContent => {
  return content.kind === 'media' && content.mediaType === 'image';
};

export const isAudioMedia = (content: RichMessageContent): content is MediaMessageContent => {
  return content.kind === 'media' && content.mediaType === 'audio';
};

export const isFileMedia = (content: RichMessageContent): content is MediaMessageContent => {
  return content.kind === 'media' && content.mediaType === 'file';
};
