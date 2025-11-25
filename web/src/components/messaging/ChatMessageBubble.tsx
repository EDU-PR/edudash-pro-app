import { parseMessageContent } from '@/lib/messaging/messageContent';

export interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    first_name: string;
    last_name: string;
    role: string;
  };
}

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  isDesktop: boolean;
  formattedTime: string;
  senderName?: string;
}

export const ChatMessageBubble = ({
  message,
  isOwn,
  isDesktop,
  formattedTime,
  senderName,
}: ChatMessageBubbleProps) => {
  const content = parseMessageContent(message.content);

  const bubbleBackground = isOwn
    ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)'
    : 'var(--surface-2)';
  const bubbleColor = isOwn ? '#fff' : 'var(--text-primary)';
  const elevation = isOwn
    ? isDesktop
      ? '0 2px 10px rgba(59, 130, 246, 0.35), 0 0 24px rgba(59, 130, 246, 0.45)'
      : '0 2px 8px rgba(59, 130, 246, 0.3)'
    : isDesktop
      ? '0 2px 10px rgba(15, 23, 42, 0.16), 0 0 20px rgba(148, 163, 184, 0.35)'
      : '0 2px 8px rgba(15, 23, 42, 0.14)';

  const renderBody = () => {
    if (content.kind === 'media') {
      if (content.mediaType === 'image') {
        return (
          <img
            src={content.url}
            alt={content.name || 'Image attachment'}
            style={{
              width: '100%',
              borderRadius: 14,
              marginBottom: 8,
              border: isOwn ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border)',
            }}
          />
        );
      }

      if (content.mediaType === 'audio') {
        return (
          <audio
            controls
            style={{ width: '100%', marginBottom: 8 }}
            src={content.url}
          />
        );
      }

      return (
        <a
          href={content.url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            color: bubbleColor,
            fontWeight: 600,
            textDecoration: 'underline',
            marginBottom: 8,
          }}
        >
          📎 {content.name || 'Download file'}
        </a>
      );
    }

    return (
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: bubbleColor }}>
        {content.text}
      </p>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isOwn ? 'flex-end' : 'flex-start',
        width: '100%',
        paddingLeft: isDesktop ? 32 : 12,
        paddingRight: isDesktop ? 32 : 12,
      }}
    >
      <div
        style={{
          maxWidth: isDesktop ? '62%' : '72%',
          width: 'fit-content',
          padding: '14px 18px',
          borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          background: bubbleBackground,
          color: bubbleColor,
          border: isOwn ? 'none' : '1px solid var(--border)',
          boxShadow: elevation,
        }}
      >
        {renderBody()}
        <div
          style={{
            marginTop: content.kind === 'media' ? 0 : 6,
            fontSize: 11,
            opacity: 0.75,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: bubbleColor,
          }}
        >
          {!isOwn && senderName && <span>{senderName}</span>}
          <span>{formattedTime}</span>
          {isOwn && <span style={{ fontSize: 14 }}>✓✓</span>}
        </div>
      </div>
    </div>
  );
};
