/**
 * Chat Messages Component
 * WARP.md compliant: ≤250 lines
 * 
 * Displays message list, empty state, typing indicator
 */

'use client';

import { useRef, useEffect } from 'react';
import { Sparkles, FileText } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage } from './types.js';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isTyping: boolean;
  onRetry?: (messageId: string, userMessage: ChatMessage) => void;
  onExamBuilderClick?: (context: { grade?: string; subject?: string; topics?: string[] }) => void;
  showExamBuilder: boolean;
  examContext: { grade?: string; subject?: string; topics?: string[] };
}

export function ChatMessages({
  messages,
  isTyping,
  onRetry,
  onExamBuilderClick,
  showExamBuilder,
  examContext,
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{
        paddingTop: '100px',
        paddingBottom: '1rem',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
        scrollBehavior: 'smooth',
      }}
    >
      <div className="w-full max-w-4xl mx-auto px-4" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minHeight: messages.length === 0 ? 'calc(100vh - 200px)' : 'auto',
        justifyContent: messages.length === 0 ? 'center' : 'flex-start'
      }}>
        {/* Empty State */}
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: 'var(--muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              boxShadow: '0 8px 32px rgba(124, 58, 237, 0.3)',
            }}>
              <Sparkles size={40} color="white" />
            </div>
            <h3 style={{
              fontSize: 24,
              fontWeight: 700,
              marginBottom: 12,
              color: 'var(--text)'
            }}>Hi! I&apos;m Dash</h3>
            <p style={{
              fontSize: 14,
              lineHeight: 1.5,
              maxWidth: 500,
              margin: '0 auto 24px'
            }}>Ask me anything! I can help with homework, explain concepts, solve problems, and more.</p>
            
            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => {
                  // Focus the chat input
                  const input = document.querySelector('textarea[placeholder*="Message"]') as HTMLTextAreaElement;
                  if (input) input.focus();
                }}
                style={{
                  padding: '12px 24px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
                  border: 'none',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(124, 58, 237, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.3)';
                }}
              >
                <Sparkles size={16} />
                Start Your First Chat
              </button>
            </div>
          </div>
        )}

        {/* Message List */}
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            onRetry={message.isError && index > 0 && onRetry ? () => {
              const lastUserMessage = messages[index - 1];
              if (lastUserMessage && lastUserMessage.role === 'user') {
                onRetry(message.id, lastUserMessage);
              }
            } : undefined}
          />
        ))}

        {/* Exam Builder Prompt */}
        {messages.length > 0 && 
         messages[messages.length - 1]?.role === 'assistant' &&
         messages[messages.length - 1]?.content.toLowerCase().includes('exam builder') && 
         onExamBuilderClick && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: '12px',
            marginBottom: '8px',
            width: '100%'
          }}>
            <button
              onClick={() => onExamBuilderClick(examContext)}
              className="btn btnPrimary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(124, 58, 237, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.25)';
              }}
            >
              <FileText size={18} />
              Launch Exam Builder
              <Sparkles size={16} />
            </button>
          </div>
        )}

        {/* Typing Indicator - Animated */}
        {isTyping && (
          <div style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            paddingLeft: 4,
            paddingRight: 4
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              animation: 'spin 2s linear infinite'
            }}>
              <Sparkles size={16} color="white" />
            </div>
            <div style={{
              background: 'var(--surface-1)',
              padding: '12px 16px',
              borderRadius: '16px 16px 16px 4px',
              border: '1px solid var(--border)',
              display: 'flex',
              gap: 4,
              alignItems: 'center'
            }}>
              <div className="typing-dot" style={{ animationDelay: '0ms' }}></div>
              <div className="typing-dot" style={{ animationDelay: '150ms' }}></div>
              <div className="typing-dot" style={{ animationDelay: '300ms' }}></div>
            </div>
            <style jsx>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              .typing-dot {
                width: 8px;
                height: 8px;
                borderRadius: '50%';
                background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
                animation: typing-bounce 1.4s infinite ease-in-out;
              }
              @keyframes typing-bounce {
                0%, 60%, 100% { transform: translateY(0); opacity: 0.7; }
                30% { transform: translateY(-10px); opacity: 1; }
              }
            `}</style>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
