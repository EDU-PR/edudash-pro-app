import { parseMessageContent } from '@/lib/messaging/messageContent';
import { User } from 'lucide-react';

// Add CSS animation for pulsing glow
if (typeof document !== 'undefined' && !document.querySelector('#pulse-glow-styles')) {
  const style = document.createElement('style');
  style.id = 'pulse-glow-styles';
  style.textContent = `
    @keyframes pulse-glow {
      0%, 100% {
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.15), 0 4px 12px rgba(15, 23, 42, 0.1), 0 0 4px rgba(139, 92, 246, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05);
      }
      50% {
        box-shadow: 0 3px 10px rgba(15, 23, 42, 0.18), 0 6px 16px rgba(15, 23, 42, 0.12), 0 0 8px rgba(139, 92, 246, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      }
    }
    @media (max-width: 1024px) {
      @keyframes pulse-glow {
        0%, 100% {
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.12), 0 3px 10px rgba(15, 23, 42, 0.08), 0 0 3px rgba(139, 92, 246, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }
        50% {
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.15), 0 4px 12px rgba(15, 23, 42, 0.1), 0 0 6px rgba(139, 92, 246, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.06);
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

  // Improved color scheme for better contrast and distinction
  const bubbleBackground = isOwn
    ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
    : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';
  const bubbleColor = isOwn ? '#ffffff' : '#e2e8f0';
  const bubbleBorder = isOwn 
    ? '1px solid rgba(59, 130, 246, 0.3)' 
    : '1px solid rgba(148, 163, 184, 0.2)';
  const elevation = isOwn
    ? isDesktop
      ? '0 4px 16px rgba(59, 130, 246, 0.25), 0 2px 8px rgba(37, 99, 235, 0.15)'
      : '0 2px 10px rgba(59, 130, 246, 0.2), 0 1px 4px rgba(37, 99, 235, 0.1)'
    : isDesktop
      ? '0 2px 8px rgba(15, 23, 42, 0.15), 0 4px 12px rgba(15, 23, 42, 0.1), 0 0 4px rgba(139, 92, 246, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
      : '0 2px 6px rgba(15, 23, 42, 0.12), 0 3px 10px rgba(15, 23, 42, 0.08), 0 0 3px rgba(139, 92, 246, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.04)';

  // Get sender initials for avatar
  const getInitials = (name?: string) => {
    if (!name || name.trim() === '') return '?';
    const parts = name.trim().split(' ').filter(part => part.length > 0);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0]?.[0]?.toUpperCase() || '?';
  };

  const renderBody = () => {
    if (content.kind === 'media') {
      if (content.mediaType === 'image') {
        return (
          <img
            src={content.url}
            alt={content.name || 'Image attachment'}
            style={{
              width: '100%',
              maxWidth: 300,
              borderRadius: 12,
              marginBottom: 8,
              border: isOwn ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(148, 163, 184, 0.2)',
            }}
          />
        );
      }

      if (content.mediaType === 'audio') {
        return (
          <audio
            controls
            style={{ width: '100%', maxWidth: 280, marginBottom: 8 }}
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
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: bubbleColor, letterSpacing: '0.01em' }}>
        {content.text}
      </p>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isOwn ? 'flex-end' : 'flex-start',
        alignItems: 'flex-end',
        width: '100%',
        paddingLeft: isDesktop ? 4 : 8,
        paddingRight: isDesktop ? 32 : 12,
        marginBottom: isDesktop ? 8 : 4,
        gap: 12,
      }}
    >
      {/* Avatar for received messages */}
      {!isOwn && (
        <div
          style={{
            width: isDesktop ? 36 : 32,
            height: isDesktop ? 36 : 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
            marginBottom: 2,
          }}
        >
          {senderName ? (
            <span style={{ color: '#fff', fontSize: isDesktop ? 13 : 11, fontWeight: 600 }}>
              {getInitials(senderName)}
            </span>
          ) : (
            <User size={isDesktop ? 18 : 16} color="#fff" />
          )}
        </div>
      )}
      
      <div
        style={{
          maxWidth: isDesktop ? '65%' : '75%',
          width: 'fit-content',
          padding: isDesktop ? '14px 20px' : '12px 16px',
          borderRadius: isOwn ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
          background: bubbleBackground,
          color: bubbleColor,
          border: bubbleBorder,
          boxShadow: elevation,
          animation: !isOwn ? 'pulse-glow 4s ease-in-out infinite' : 'none',
          transform: 'translateZ(0)',
        }}
      >
        {/* Sender name for received messages */}
        {!isOwn && senderName && (
          <div style={{ 
            marginBottom: 6, 
            fontSize: 12, 
            fontWeight: 600, 
            color: '#a78bfa',
            letterSpacing: '0.02em'
          }}>
            {senderName}
          </div>
        )}
        
        {renderBody()}
        
        <div
          style={{
            marginTop: content.kind === 'media' ? 4 : 8,
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: isOwn ? 'flex-end' : 'flex-start',
            gap: 6,
            color: isOwn ? 'rgba(255, 255, 255, 0.7)' : 'rgba(148, 163, 184, 0.8)',
          }}
        >
          <span>{formattedTime}</span>
          {isOwn && (
            <span 
              style={{ 
                  fontSize: 14,
                  fontWeight: isRead ? 700 : 400,
                  color: isRead ? '#a855f7' : 'rgba(255, 255, 255, 0.6)',
                  opacity: isRead ? 1 : 0.75,
                  textShadow: isRead ? '0 0 8px rgba(168, 85, 247, 0.5)' : 'none',
                  transition: 'all 0.3s ease',
              }}
            >
              ✓✓
            </span>
          )}
        </div>
      </div>

      {/* Spacer for sent messages (to maintain alignment) */}
      {isOwn && (
        <div style={{ width: isDesktop ? 36 : 32, flexShrink: 0 }} />
      )}
    </div>
  );
};
