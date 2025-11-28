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
          box-shadow: 0 3px 8px rgba(17, 30, 61, 0.18), 0 6px 16px rgba(15, 23, 42, 0.12), 0 0 6px rgba(139, 92, 246, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08);
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
  delivered_to?: string[];
  sender?: {
    first_name: string;
    last_name: string;
    role: string;
  };
}

// Message status types for WhatsApp-style ticks
type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  isDesktop: boolean;
  formattedTime: string;
  senderName?: string;
  otherParticipantIds?: string[];
  hideAvatars?: boolean;
  onContextMenu?: (e: React.MouseEvent | React.TouchEvent, messageId: string) => void;
}

// WhatsApp-style tick component
const MessageTicks = ({ status }: { status: MessageStatus }) => {
  // Single grey tick = sent
  // Double grey tick = delivered
  // Double blue tick = read
  
  if (status === 'sending') {
    return (
      <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.4)' }}>
        ○
      </span>
    );
  }
  
  if (status === 'sent') {
    return (
      <span style={{ 
        fontSize: 14, 
        color: 'rgba(255, 255, 255, 0.6)',
        fontWeight: 500,
      }}>
        ✓
      </span>
    );
  }
  
  if (status === 'delivered') {
    return (
      <span style={{ 
        fontSize: 14, 
        color: 'rgba(255, 255, 255, 0.6)',
        fontWeight: 500,
        letterSpacing: '-3px',
      }}>
        ✓✓
      </span>
    );
  }
  
  // Read - blue ticks
  return (
    <span style={{ 
      fontSize: 14, 
      fontWeight: 600,
      color: '#34d399', // WhatsApp-style blue-green for read
      letterSpacing: '-3px',
      textShadow: '0 0 6px rgba(52, 211, 153, 0.4)',
    }}>
      ✓✓
    </span>
  );
};

export const ChatMessageBubble = ({
  message,
  isOwn,
  isDesktop,
  formattedTime,
  senderName,
  otherParticipantIds = [],
  hideAvatars = false,
  onContextMenu,
}: ChatMessageBubbleProps) => {
  const content = parseMessageContent(message.content);
  
  // Determine message status for ticks
  const getMessageStatus = (): MessageStatus => {
    if (!isOwn) return 'sent'; // Not applicable for received messages
    
    // Check if read by any other participant
    const isRead = message.read_by && otherParticipantIds.length > 0
      ? otherParticipantIds.some(id => message.read_by?.includes(id))
      : false;
    
    if (isRead) return 'read';
    
    // Check if delivered to any other participant
    const isDelivered = message.delivered_to && otherParticipantIds.length > 0
      ? otherParticipantIds.some(id => message.delivered_to?.includes(id))
      : false;
    
    if (isDelivered) return 'delivered';
    
    // If we have an ID, it's been saved to DB (sent)
    // For now, treat all saved messages as delivered since we don't track delivery separately
    return message.id ? 'delivered' : 'sending';
  };
  
  const messageStatus = getMessageStatus();

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
              maxWidth: 280,
              borderRadius: 10,
              marginBottom: 4,
              border: isOwn ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(148, 163, 184, 0.2)',
              display: 'block',
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
        maxWidth: '100%',
        paddingLeft: isDesktop ? 8 : (isOwn ? 0 : 6),
        paddingRight: isDesktop ? 280 : (isOwn ? 6 : 0),
        gap: 8,
        alignItems: 'flex-end',
      }}
    >
      {/* Avatar for received messages */}
      {!hideAvatars && !isOwn && (
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
          maxWidth: isDesktop ? '65%' : '80%',
          width: 'fit-content',
          padding: content.kind === 'media' 
            ? (isDesktop ? '6px 6px' : '4px 4px') 
            : (isDesktop ? '10px 16px' : '8px 12px'),
          borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: bubbleBackground,
          color: bubbleColor,
          border: bubbleBorder,
          boxShadow: elevation,
          animation: !isOwn ? 'pulse-glow 4s ease-in-out infinite' : 'none',
          transform: 'translateZ(0)',
          cursor: 'pointer',
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu?.(e, message.id);
        }}
        onTouchStart={(e) => {
          const target = e.currentTarget;
          let longPressTriggered = false;
          
          const timer = setTimeout(() => {
            longPressTriggered = true;
            onContextMenu?.(e, message.id);
          }, 500); // Long press duration
          
          const clearTimer = () => {
            clearTimeout(timer);
            if (target) {
              target.removeEventListener('touchend', clearTimer);
              target.removeEventListener('touchmove', clearTimer);
            }
          };
          
          target.addEventListener('touchend', clearTimer, { once: true });
          target.addEventListener('touchmove', clearTimer, { once: true });
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
            marginTop: content.kind === 'media' ? 2 : 3,
            fontSize: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: isOwn ? 'flex-end' : 'flex-start',
            gap: 4,
            color: isOwn ? 'rgba(255, 255, 255, 0.6)' : 'rgba(148, 163, 184, 0.7)',
          }}
        >
          <span>{formattedTime}</span>
          {isOwn && <MessageTicks status={messageStatus} />}
        </div>
      </div>

      {/* Spacer for sent messages (to maintain alignment) */}
      {isOwn && !hideAvatars && (
        <div style={{ width: isDesktop ? 36 : 32, flexShrink: 0 }} />
      )}
    </div>
  );
};
