'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Camera, Loader2, Sparkles, X, FileText } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { ImageUpload } from './ImageUpload';
import { ExamBuilderLauncher } from './ExamBuilderLauncher';
import { createClient } from '@/lib/supabase/client';
import { dashAIThrottler } from '@/lib/dash-ai-throttle';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  images?: Array<{ data: string; media_type: string; preview?: string }>;
  meta?: {
    tokensUsed?: number;
    model?: string;
  };
  isError?: boolean;
}

interface ChatInterfaceProps {
  conversationId: string;
  onNewConversation?: () => void;
  initialMessages?: ChatMessage[];
}

export function ChatInterface({
  conversationId,
  onNewConversation,
  initialMessages = []
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Array<{ data: string; media_type: string; preview: string; url?: string }>>([]);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showExamBuilder, setShowExamBuilder] = useState(false);
  const [examContext, setExamContext] = useState<{ grade?: string; subject?: string; topics?: string[] }>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();

  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [input]);

  // Load conversation from database
  useEffect(() => {
    if (conversationId && initialMessages.length === 0) {
      loadConversation();
    }
  }, [conversationId]);

  const loadConversation = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('messages')
        .eq('conversation_id', conversationId)
        .maybeSingle();

      if (error) {
        // If conversation doesn't exist yet, that's okay - it's a new conversation
        if (error.code === 'PGRST116') {
          console.log('New conversation - no existing messages');
          return;
        }
        throw error;
      }

      if (data?.messages) {
        const parsedMessages = (data.messages as any[]).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(parsedMessages);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      // Don't show error to user for new conversations
    }
  };

  const saveConversation = async (updatedMessages: ChatMessage[]) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('preschool_id, organization_id')
        .eq('id', userData.user.id)
        .single();

      // Allow null preschool_id for independent parents - store as null when absent
      const preschoolId = profile?.preschool_id || profile?.organization_id || null;

      // Check if conversation exists
      const { data: existing } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('conversation_id', conversationId)
        .maybeSingle();

      const conversationData = {
        user_id: userData.user.id,
        preschool_id: preschoolId,
        conversation_id: conversationId,
        title: updatedMessages[0]?.content.substring(0, 50) || 'New Chat',
        messages: updatedMessages,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        // Update existing
        await supabase
          .from('ai_conversations')
          .update(conversationData)
          .eq('conversation_id', conversationId);
      } else {
        // Insert new
        await supabase
          .from('ai_conversations')
          .insert(conversationData);
      }
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim();

    if (!textToSend && selectedImages.length === 0) return;

    // Image uploads are now allowed for all tiers with daily limits enforced server-side
    
    // Check if request will be queued
    if (dashAIThrottler.wouldWait()) {
      const waitSeconds = Math.ceil(dashAIThrottler.getWaitTime() / 1000);
      const queueMessage: ChatMessage = {
        id: `msg-${Date.now()}-queue`,
        role: 'assistant',
        content: `⏳ Please wait ${waitSeconds} seconds... (Rate limit protection)`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, queueMessage]);
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: textToSend || '📷 [Image attached]',
      timestamp: new Date(),
      images: selectedImages.length > 0 ? selectedImages : undefined,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setSelectedImages([]);
    setIsLoading(true);
    setIsTyping(true);

    // Debug: Log image data before sending
    if (selectedImages.length > 0) {
      console.log('[ChatInterface] Sending images:', selectedImages.map(img => ({
        hasData: !!img.data,
        hasPreview: !!img.preview,
        mediaType: img.media_type,
        dataLength: img.data.length,
        previewLength: img.preview?.length || 0
      })));
    }

    try {
      // Build conversation history in Claude API format
      const conversationHistory = newMessages.map((msg) => {
        const hasImages = msg.images && msg.images.length > 0;
        
        if (hasImages) {
          // Message with images - use array format
          return {
            role: msg.role,
            content: [
              {
                type: 'text',
                text: msg.content,
              },
              ...msg.images!.map((img) => ({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: img.media_type,
                  data: img.data,
                },
              })),
            ],
          };
        } else {
          // Text-only message
          return {
            role: msg.role,
            content: msg.content,
          };
        }
      });

      console.log('Sending conversation with', conversationHistory.length, 'messages');

      // Get auth token (required for edge function auth validation)
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      // Call AI proxy with full conversation history and image context (throttled)
      const result: any = await dashAIThrottler.enqueue(() =>
        supabase.functions.invoke('ai-proxy', {
        body: {
          scope: 'parent',
          service_type: 'dash_conversation',
          payload: {
            // Ensure prompt is never empty (image-only messages need a placeholder to satisfy edge function validation)
            prompt: textToSend || userMessage.content,
            images: selectedImages.length > 0 ? selectedImages.map(img => ({
              data: img.data,
              media_type: img.media_type,
            })) : undefined,
            conversationHistory: conversationHistory, // Send full formatted history
            // Hint to Dash that images are attached - use curriculum tools
            image_context: selectedImages.length > 0 ? {
              has_images: true,
              image_count: selectedImages.length,
              hint: 'Images uploaded. If extractable as exam/homework material, identify grade/subject/topic and offer curriculum help: past papers, practice questions, or study guides.'
            } : undefined,
          },
          metadata: {
            role: 'parent',
            supports_images: true, // Indicate that images can be generated
            allow_diagrams: true,  // Allow mermaid diagrams and illustrations
          },
          enable_tools: true, // Enable CAPS curriculum & database tools
          prefer_openai: true,
          stream: false,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
      );
      const { data, error } = result as any;

      setIsTyping(false);

      if (error) {
        console.error('AI proxy error:', error);

        // Handle specific daily limit errors
        if (error.message?.includes('daily_limit_exceeded')) {
          const dailyLimitMessage: ChatMessage = {
            id: `msg-${Date.now()}-daily-limit`,
            role: 'assistant',
            content: `📊 **Daily Image Limit Reached**\n\nFree tier allows **4 images per day**.\n\n${error.message.includes('remaining') ? error.message : 'You\'ve reached your daily limit. Upgrade to Starter for unlimited image analysis!'}`,
            timestamp: new Date(),
            isError: false,
          };
          setMessages(prev => [...prev, dailyLimitMessage]);
          setInput('');
          setSelectedImages([]);
          setIsLoading(false);
          setIsTyping(false);
          return;
        }

        throw error;
      }

      // Handle successful response
      // Normalize assistant content for better readability on web (insert paragraph breaks for long single-line outputs)
      const rawContent = data?.content || data?.text || 'I apologize, but I received an empty response.';

      const formatAssistantContent = (txt: string) => {
        try {
          // If already contains multiple newlines, assume formatting is fine
          const newlineCount = (txt.match(/\n/g) || []).length;
          if (newlineCount >= 2) return txt;

          // If short, return as-is
          if (txt.length < 180) return txt;

          // Insert paragraph breaks after sentence-ending punctuation followed by space
          // e.g. "This is one. This is two." -> "This is one.\n\nThis is two."
          const withBreaks = txt.replace(/([.?!])\s+(?=[A-Z0-9"])/g, '$1\n\n');
          return withBreaks;
        } catch (e) {
          return txt;
        }
      };

      const content = formatAssistantContent(String(rawContent));
      const tokensIn = data?.usage?.tokens_in || data?.tokensIn || 0;
      const tokensOut = data?.usage?.tokens_out || data?.tokensOut || 0;

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content,
        timestamp: new Date(),
        meta: {
          tokensUsed: tokensIn + tokensOut,
          model: data?.model || 'unknown',
        },
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);
      
      // Check if this was an exam request and offer to launch exam builder
      if (detectExamRequest(textToSend)) {
        const context = extractExamContext(textToSend);
        setExamContext(context);
        
        // Add a follow-up message with exam builder button
        setTimeout(() => {
          const examBuilderPrompt: ChatMessage = {
            id: `msg-${Date.now()}-prompt`,
            role: 'assistant',
            content: `Would you like me to help you create a structured exam using the interactive exam builder? It provides a step-by-step process with CAPS-aligned questions.`,
            timestamp: new Date(),
          };
          setMessages([...finalMessages, examBuilderPrompt]);
        }, 500);
      }
      
      // Save to database
      await saveConversation(finalMessages);

    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
      
      // Enhanced error handling with user-friendly messages
      let errorContent = '❌ Sorry, I encountered an error. Please try again.';
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMsg = String(error.message).toLowerCase();
        
        if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
          errorContent = `⏳ **Too many requests right now.**\n\nThe AI service is busy. Please wait 30 seconds and try again.\n\n💡 **Tip**: Avoid sending multiple questions rapidly. Let me finish responding first!`;
        } else if (errorMsg.includes('quota')) {
          errorContent = `📊 **Daily AI quota reached.**\n\nYou've used your free daily limit. Upgrade to Premium for unlimited access or try again tomorrow.`;
        } else if (errorMsg.includes('503') || errorMsg.includes('service unavailable')) {
          errorContent = '🔧 The AI service is temporarily unavailable. Please try again in a few moments.';
        } else if (errorMsg.includes('timeout')) {
          errorContent = '⏱️ Request took too long. Please try with a shorter message or without images.';
        } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
          errorContent = '🌐 Network error. Please check your connection and try again.';
        } else {
          // Include actual error message for debugging (truncated)
          const truncatedError = errorMsg.substring(0, 100);
          errorContent = `❌ **Error**: ${truncatedError}${errorMsg.length > 100 ? '...' : ''}\n\nPlease try again or contact support if this persists.`;
        }
      }
      
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
        isError: true,
      };
      
      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageSelect = (images: Array<{ data: string; media_type: string; preview: string }>) => {
    setSelectedImages(images);
    setShowImageUpload(false);

    // Auto-scroll to bottom after adding images
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const removeImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  // Detect if user is requesting an exam and extract context
  const detectExamRequest = (text: string): boolean => {
    const examKeywords = [
      'exam', 'test', 'practice', 'assessment', 'questions',
      'quiz', 'worksheet', 'revision', 'prepare', 'study'
    ];
    
    const lowerText = text.toLowerCase();
    return examKeywords.some(keyword => lowerText.includes(keyword));
  };

  const extractExamContext = (text: string): { grade?: string; subject?: string; topics?: string[] } => {
    const lowerText = text.toLowerCase();
    
    // Extract grade
    let grade: string | undefined;
    const gradeMatch = lowerText.match(/grade\s*(\d+|r)/i);
    if (gradeMatch) {
      const gradeNum = gradeMatch[1];
      grade = gradeNum.toLowerCase() === 'r' ? 'grade_r' : `grade_${gradeNum}`;
    }
    
    // Extract subject
    let subject: string | undefined;
    const subjects = [
      'mathematics', 'math', 'maths',
      'english', 'home language', 'first additional',
      'physical sciences', 'physics', 'chemistry',
      'life sciences', 'biology',
      'geography', 'history',
      'accounting', 'business', 'economics',
      'life orientation'
    ];
    
    for (const subj of subjects) {
      if (lowerText.includes(subj)) {
        // Map common variations
        if (subj === 'math' || subj === 'maths') subject = 'Mathematics';
        else if (subj === 'physics' || subj === 'chemistry') subject = 'Physical Sciences';
        else if (subj === 'biology') subject = 'Life Sciences';
        else if (subj === 'business') subject = 'Business Studies';
        else subject = subj.charAt(0).toUpperCase() + subj.slice(1);
        break;
      }
    }
    
    // Extract topics (simple word extraction after "about" or "on")
    const topics: string[] = [];
    const topicMatch = lowerText.match(/(?:about|on|covering)\s+([a-z\s]+?)(?:\.|,|$)/i);
    if (topicMatch) {
      topics.push(topicMatch[1].trim());
    }
    
    return { grade, subject, topics: topics.length > 0 ? topics : undefined };
  };

  return (
    <>
      {/* Exam Builder Overlay */}
      {showExamBuilder && (
        <div className="absolute inset-0 z-50">
          <ExamBuilderLauncher
            suggestedGrade={examContext.grade}
            suggestedSubject={examContext.subject}
            suggestedTopics={examContext.topics}
            onClose={() => setShowExamBuilder(false)}
          />
        </div>
      )}

      {/* Messages Area - Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-950 [&::-webkit-scrollbar]:hidden flex items-center justify-center" style={{
        scrollBehavior: 'smooth',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch'
      }}>
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-4">
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
            }}>Hi! I'm Dash</h3>
            <p style={{
              fontSize: 14,
              lineHeight: 1.5,
              maxWidth: 500,
              margin: '0 auto'
            }}>Ask me anything! I can help with homework, explain concepts, solve problems, and more.</p>
          </div>
        )}

        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            onRetry={message.isError && index > 0 ? () => {
              // Find the last user message before this error
              const lastUserMessage = messages[index - 1];
              if (lastUserMessage && lastUserMessage.role === 'user') {
                // Remove error message
                setMessages(messages.filter(m => m.id !== message.id));
                // Retry with the last user message
                setInput(lastUserMessage.content);
                setSelectedImages(
                  (lastUserMessage.images || []).map((img) => ({
                    data: img.data,
                    media_type: img.media_type,
                    // Ensure preview is always present to satisfy state type
                    preview: img.preview ?? `data:${img.media_type};base64,${img.data}`,
                  }))
                );
                // Trigger send automatically
                setTimeout(() => handleSend(), 100);
              }
            } : undefined}
          />
        ))}

        {/* Show Exam Builder button after exam-related responses */}
        {messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' &&
         messages[messages.length - 1]?.content.toLowerCase().includes('exam builder') && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: '12px',
            marginBottom: '8px',
            width: '100%'
          }}>
            <button
              onClick={() => {
                // Extract context from the last assistant message
                const lastMessage = messages[messages.length - 1];
                if (lastMessage) {
                  const context = extractExamContext(lastMessage.content);
                  setExamContext(context);
                }
                setShowExamBuilder(true);
              }}
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

        {isTyping && (
          <div className="chat-typing">
            <div className="chat-logo" style={{width:32,height:32,margin:0}}>
              <Sparkles size={16} color="white" />
            </div>
            <div className="chat-typing-bubble">
              <div style={{ display: 'flex', gap: 4 }}>
                <div className="typing-dot" style={{ animationDelay: '0ms' }}></div>
                <div className="typing-dot" style={{ animationDelay: '150ms' }}></div>
                <div className="typing-dot" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
      </div>

      {/* Image Upload Modal */}
      {showImageUpload && (
        <ImageUpload
          onSelect={handleImageSelect}
          onClose={() => setShowImageUpload(false)}
          maxImages={3}
        />
      )}

      {/* Selected Images Preview */}
      {selectedImages.length > 0 && (
        <div className="border-t border-gray-800 bg-gray-950 px-4 py-3 flex-shrink-0" style={{
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)'
        }}>
          <div className="w-full max-w-4xl mx-auto flex gap-2 flex-wrap">
            {selectedImages.map((img, index) => (
              <div key={index} style={{
                position: 'relative',
                width: '60px',
                height: '60px',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '2px solid var(--primary)',
                boxShadow: '0 2px 12px rgba(124, 58, 237, 0.3)',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(124, 58, 237, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 12px rgba(124, 58, 237, 0.3)';
              }}>
                <img
                  src={img.preview}
                  alt={`Selected ${index + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(index);
                  }}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.9)',
                    border: '2px solid white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(220, 38, 38, 1)';
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <X size={10} color="white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area - Fixed Bottom */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-800 bg-gray-950 z-20" style={{
        paddingTop: '12px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
      }}>
        <div className="w-full max-w-4xl mx-auto flex gap-2 items-end">
          {/* Text Input Container with Camera Inside */}
          <div style={{ 
            flex: 1,
            position: 'relative',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'flex-end',
            minHeight: 44,
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            paddingLeft: input.trim() ? '14px' : '8px',
            paddingRight: '8px',
            paddingTop: '8px',
            paddingBottom: '8px',
            gap: '8px'
          }}
          onFocusCapture={(e) => {
            e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(124,58,237,0.15)';
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
          }}
          >
            {/* Camera Button - Hidden when typing */}
            {!input.trim() && (
              <button
                onClick={() => setShowImageUpload(true)}
                disabled={isLoading}
                style={{
                  width: 28,
                  height: 28,
                  padding: 0,
                  borderRadius: '50%',
                  background: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: isLoading ? 0.5 : 0.7
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.opacity = '1';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.opacity = '0.7';
                  }
                }}
                title="Attach image or photo"
              >
                <Camera size={20} color="var(--muted)" />
              </button>
            )}
            
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-resize textarea with dynamic growth
                if (inputRef.current) {
                  inputRef.current.style.height = 'auto';
                  const newHeight = Math.min(inputRef.current.scrollHeight, 150); // Max 150px before scroll
                  inputRef.current.style.height = newHeight + 'px';
                }
              }}
              onKeyPress={handleKeyPress}
              placeholder="Message Dash..."
              disabled={isLoading}
              style={{ 
                flex: 1,
                height: 'auto',
                minHeight: '28px',
                maxHeight: '150px',
                padding: 0,
                fontSize: '16px', // 16px prevents zoom on iOS mobile
                border: 'none',
                background: 'transparent',
                color: 'var(--text)',
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: '1.4',
                outline: 'none',
                overflowY: 'auto',
                fontWeight: 400,
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(124, 58, 237, 0.3) transparent'
              }}
              rows={1}
            />
          </div>

          {/* Send Button - Outside text area */}
          <button
            onClick={() => handleSend()}
            disabled={isLoading || (!input.trim() && selectedImages.length === 0)}
            style={{ 
              width: 44,
              height: 44,
              padding: 0,
              border: 'none',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              cursor: (isLoading || (!input.trim() && selectedImages.length === 0)) ? 'not-allowed' : 'pointer',
              opacity: (isLoading || (!input.trim() && selectedImages.length === 0)) ? 0.4 : 1,
              background: (isLoading || (!input.trim() && selectedImages.length === 0)) 
                ? 'var(--muted)' 
                : 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)'
            }}
            onMouseEnter={(e) => {
              if (!isLoading && (input.trim() || selectedImages.length > 0)) {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.4)';
                e.currentTarget.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #f472b6 100%)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading && (input.trim() || selectedImages.length > 0)) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(124, 58, 237, 0.3)';
                e.currentTarget.style.background = 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)';
              }
            }}
            onMouseDown={(e) => {
              if (!isLoading && (input.trim() || selectedImages.length > 0)) {
                e.currentTarget.style.transform = 'scale(0.95)';
              }
            }}
            onMouseUp={(e) => {
              if (!isLoading && (input.trim() || selectedImages.length > 0)) {
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
          >
            {isLoading ? <Loader2 size={18} className="spin" color="white" /> : <Send size={18} color="white" />}
          </button>
        </div>
      </div>
    </>
  );
}
