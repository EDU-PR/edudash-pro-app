import { parseMessageContent } from '@/lib/messaging/messageContent';

// Add CSS animation for pulsing glow
if (typeof document !== 'undefined' && !document.querySelector('#pulse-glow-styles')) {
  const style = document.createElement('style');
  style.id = 'pulse-glow-styles';
  style.textContent = `
    @keyframes pulse-glow {
      0%, 100% {
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2), 0 8px 20px rgba(15, 23, 42, 0.15), 0 0 8px rgba(139, 92, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      }
      50% {
        box-shadow: 0 6px 16px rgba(15, 23, 42, 0.25), 0 12px 28px rgba(15, 23, 42, 0.18), 0 0 16px rgba(139, 92, 246, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.15);
      }
    }
    @media (max-width: 1024px) {
      @keyframes pulse-glow {
        0%, 100% {
          box-shadow: 0 3px 8px rgba(15, 23, 42, 0.18), 0 6px 16px rgba(15, 23, 42, 0.12), 0 0 6px rgba(139, 92, 246, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }
        50% {
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.22), 0 8px 20px rgba(15, 23, 42, 0.15), 0 0 12px rgba(139, 92, 246, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12);
        }
      }
    }
  `;
  document.head.appendChild(style);
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_by?: string[];
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
  otherParticipantIds?: string[];
}

export const ChatMessageBubble = ({
  message,
  isOwn,
  isDesktop,
  formattedTime,
  senderName,
  otherParticipantIds = [],
}: ChatMessageBubbleProps) => {
  const content = parseMessageContent(message.content);
  
  // Check if message is read by other participants
  const isRead = isOwn && message.read_by && otherParticipantIds.length > 0
    ? otherParticipantIds.some(id => message.read_by?.includes(id))
    : false;

  const bubbleBackground = isOwn
    ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)'
    : 'var(--surface-2)';
  const bubbleColor = isOwn ? '#fff' : 'var(--text-primary)';
  const elevation = isOwn
    ? isDesktop
      ? '0 2px 10px rgba(59, 130, 246, 0.35), 0 0 24px rgba(59, 130, 246, 0.45)'
      : '0 2px 8px rgba(59, 130, 246, 0.3)'
    : isDesktop
      ? '0 4px 12px rgba(15, 23, 42, 0.2), 0 8px 20px rgba(15, 23, 42, 0.15), 0 0 8px rgba(139, 92, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
      : '0 3px 8px rgba(15, 23, 42, 0.18), 0 6px 16px rgba(15, 23, 42, 0.12), 0 0 6px rgba(139, 92, 246, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08)';

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
        paddingLeft: isDesktop ? 20 : 0,
        paddingRight: isDesktop ? 8 : 0,
      }}
    >
      <div
        style={{
          maxWidth: isDesktop ? '70%' : '80%',
          width: 'fit-content',
          padding: '14px 18px',
          borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          background: bubbleBackground,
          color: bubbleColor,
          border: isOwn ? 'none' : '1px solid rgba(139, 92, 246, 0.2)',
          boxShadow: elevation,
          animation: !isOwn ? 'pulse-glow 3s ease-in-out infinite' : 'none',
          transform: !isOwn ? 'translateZ(0)' : 'none',
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
          {isOwn && (
            <span 
              style={{ 
                fontSize: 14,
                fontWeight: isRead ? 700 : 400,
                color: isRead ? '#a855f7' : 'rgba(255, 255, 255, 0.6)',
                opacity: isRead ? 1 : 0.75,
                textShadow: isRead ? '0 0 8px rgba(168, 85, 247, 0.5)' : 'none',
                transition: 'all 0.3s ease'
              }}
            >
              ✓✓
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
