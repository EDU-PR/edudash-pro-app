/**
 * DashOrb - Floating AI Assistant for Super Admin Dashboard
 * 
 * A powerful floating orb that provides real AI-powered operations:
 * - Query platform analytics and metrics
 * - Manage users, schools, subscriptions
 * - Trigger EAS builds (Android/iOS)
 * - Search codebase via GitHub API
 * - Execute database queries
 * - Send announcements
 * - Generate reports
 * - Manage feature flags
 * 
 * Connects to superadmin-ai Edge Function for secure API access.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Animated,
  Easing,
  TouchableOpacity,
  PanResponder,
  Dimensions,
  View,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { assertSupabase } from '../../lib/supabase';
import { getWelcomeMessage } from '../../lib/ai/constants';
import { styles } from './DashOrb.styles';
import { ChatModal, ChatMessage } from './ChatModal';
import { QuickAction } from './QuickActions';
import { useVoiceTTS } from '../super-admin/voice-orb/useVoiceTTS';
import { useVoiceRecorder } from '../super-admin/voice-orb/useVoiceRecorder';
import { useVoiceSTT } from '../super-admin/voice-orb/useVoiceSTT';
import { useWakeWord } from '../../hooks/useWakeWord';
import { CosmicOrb } from './CosmicOrb';
import { sanitizeInput, validateCommand, RateLimiter } from '../../lib/security/validators';
import { useAuth } from '../../contexts/AuthContext';
import { isSuperAdmin } from '../../lib/roleUtils';
import { calculateAge } from '../../lib/date-utils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DashOrbProps {
  /** Position of the orb */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Size of the orb */
  size?: number;
  /** Callback when a command is executed */
  onCommandExecuted?: (command: string, result: unknown) => void;
}

export default function DashOrb({
  position = 'bottom-right',
  size = 60,
  onCommandExecuted,
}: DashOrbProps) {
  // Get user profile for role-based AI endpoint selection
  const { profile } = useAuth();
  const userRole = profile?.role?.toLowerCase() || '';
  const normalizedRole = userRole || 'parent';
  const isUserSuperAdmin = isSuperAdmin(normalizedRole);
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [pendingTutorIntent, setPendingTutorIntent] = useState<{ prompt: string; label?: string } | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isListeningForCommand, setIsListeningForCommand] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [lastDetectedLanguage, setLastDetectedLanguage] = useState<'en-ZA' | 'af-ZA' | 'zu-ZA' | null>(null);
  const [quickActionAge, setQuickActionAge] = useState('auto');
  const [quickActionPrompt, setQuickActionPrompt] = useState('');

  const normalizeSupportedLanguage = (lang?: string | null): 'en-ZA' | 'af-ZA' | 'zu-ZA' | null => {
    if (!lang) return null;
    if (lang === 'en-ZA' || lang === 'af-ZA' || lang === 'zu-ZA') return lang;
    return null;
  };

  const resolveAgeGroupFromYears = (ageYears?: number | null) => {
    if (!ageYears && ageYears !== 0) return null;
    if (ageYears <= 5) return '3-5';
    if (ageYears <= 8) return '6-8';
    if (ageYears <= 12) return '9-12';
    if (ageYears <= 15) return '13-15';
    if (ageYears <= 18) return '16-18';
    return 'adult';
  };

  const resolveGradeBand = (ageGroup: string) => {
    switch (ageGroup) {
      case '3-5':
        return 'Grade R / Reception';
      case '6-8':
        return 'Grades 1-3';
      case '9-12':
        return 'Grades 4-6';
      case '13-15':
        return 'Grades 7-9';
      case '16-18':
        return 'Grades 10-12';
      case 'adult':
        return 'Adult learners';
      default:
        return null;
    }
  };
  
  // Rate limiter for commands (10 requests per minute)
  const rateLimiter = useRef(new RateLimiter(10, 60000)).current;
  
  // Voice TTS integration - always call the hook, conditionally use the result
  const voiceTTS = useVoiceTTS();
  const { speak, stop: stopSpeaking, isSpeaking } = Platform.OS !== 'web' 
    ? voiceTTS 
    : { speak: async () => {}, stop: async () => {}, isSpeaking: false };
  
  // Voice input integration - useVoiceRecorder returns [state, actions, audioLevel] tuple
  const voiceRecorderHookResult = useVoiceRecorder();
  const voiceRecorderResult = Platform.OS !== 'web' ? voiceRecorderHookResult : null;
  const voiceRecorderState = voiceRecorderResult ? voiceRecorderResult[0] : null;
  const voiceRecorderActions = voiceRecorderResult ? voiceRecorderResult[1] : null;
  const voiceSTTHookResult = useVoiceSTT();
  const voiceSTT = Platform.OS !== 'web' ? voiceSTTHookResult : null;
  
  // Wake word detection
  const wakeWord = useWakeWord({
    onWakeWord: () => {
      console.log('[DashOrb] Wake word "Hey Dash" detected!');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      handleWakeWordDetected();
    },
    enabled: wakeWordEnabled,
    useFallback: false, // Use Porcupine for "Hey Dash" wake word detection
  });
  
  // Animations & Gestures
  const pan = useRef(new Animated.ValueXY()).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;
  
  // Store animation instances to stop/start them
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const glowLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  
  // Initialize position
  useEffect(() => {
    let initialX = SCREEN_WIDTH - size - 20;
    let initialY = SCREEN_HEIGHT - size - 100; // Account for tab bar

    switch (position) {
      case 'bottom-left':
        initialX = 20;
        initialY = SCREEN_HEIGHT - size - 100;
        break;
      case 'top-right':
        initialX = SCREEN_WIDTH - size - 20;
        initialY = 100;
        break;
      case 'top-left':
        initialX = 20;
        initialY = 100;
        break;
    }
    
    pan.setValue({ x: initialX, y: initialY });
  }, [position, size]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        // Stop pulse loop to avoid animation conflict
        pulseLoopRef.current?.stop();
        glowLoopRef.current?.stop();
        setIsDragging(true);
        
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
        
        // Haptic feedback on grab
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        // Scale down slightly when dragging
        Animated.spring(pulseAnim, {
          toValue: 0.9,
          useNativeDriver: false,
        }).start();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        setIsDragging(false);
        
        // Snap to nearest edge logic could go here
        
        // Restore scale and restart pulse loop
        Animated.spring(pulseAnim, {
          toValue: 1,
          useNativeDriver: false,
        }).start(() => {
          // Restart pulse loop after scale animation completes
          pulseLoopRef.current?.start();
          glowLoopRef.current?.start();
        });
      },
    })
  ).current;
  
  // Pulsing animation for the orb (only when not dragging)
  useEffect(() => {
    if (isDragging) {
      pulseLoopRef.current?.stop();
      glowLoopRef.current?.stop();
      return;
    }
    
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false, // Must match PanResponder setting
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false, // Must match PanResponder setting
        }),
      ])
    );
    
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false, // Must match PanResponder setting
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false, // Must match PanResponder setting
        }),
      ])
    );

    pulseLoopRef.current = pulse;
    glowLoopRef.current = glow;
    
    pulse.start();
    glow.start();

    return () => {
      pulse.stop();
      glow.stop();
    };
  }, [isDragging]);

  // Rotation animation when processing
  useEffect(() => {
    if (isProcessing) {
      const rotation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: false, // Consistent with all other animations
        })
      );
      rotation.start();
      return () => rotation.stop();
    } else {
      rotateAnim.setValue(0);
    }
  }, [isProcessing]);

  // Expand/collapse animation
  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: isExpanded ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 40,
    }).start();
  }, [isExpanded]);

  const handleOrbPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // If speaking, interrupt and restart listening
    if (isSpeaking) {
      console.log('[DashOrb] User interrupted TTS - restarting voice input');
      await stopSpeaking();
      // Give user time to start speaking
      setTimeout(() => {
        handleMicPress();
      }, 300);
      return;
    }
    
    setIsExpanded(true);
    if (messages.length === 0) {
      if (!showQuickActions) {
        // Add welcome message based on user role
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: getWelcomeMessage(normalizedRole),
          timestamp: new Date(),
        }]);
      }
    }
  };

  const handleWakeWordDetected = async () => {
    // Wake word detected - start listening for command
    setIsExpanded(true);
    setIsListeningForCommand(true);
    
    // Add listening indicator message
    setMessages(prev => [...prev, {
      id: `listening-${Date.now()}`,
      role: 'system',
      content: '🎤 Listening...',
      timestamp: new Date(),
    }]);

    try {
      // Start recording using the actions from the hook tuple
      if (voiceRecorderActions && voiceSTT) {
        const started = await voiceRecorderActions.startRecording();
        if (!started) {
          console.error('[DashOrb] Failed to start recording');
          setIsListeningForCommand(false);
          setMessages(prev => prev.filter(m => !m.id.startsWith('listening-')));
          return;
        }
        
        // Wait for speech to complete (voiceRecorder will auto-stop on silence)
        // Poll for recording status
        const checkRecording = setInterval(async () => {
          if (voiceRecorderState && !voiceRecorderState.isRecording) {
            clearInterval(checkRecording);
            
            // Get the audio URI by stopping recording
            const audioUri = await voiceRecorderActions.stopRecording();
            if (audioUri) {
              // Transcribe the audio (default to South African English)
              const transcriptResult = await voiceSTT.transcribe(audioUri, 'auto');
              
              if (transcriptResult && transcriptResult.text && transcriptResult.text.trim()) {
                const normalized = normalizeSupportedLanguage(transcriptResult.language);
                if (normalized) setLastDetectedLanguage(normalized);
                // Remove listening message
                setMessages(prev => prev.filter(m => !m.id.startsWith('listening-')));
                
                // Process the voice command
                await handleSend(transcriptResult.text);
              }
            }
            setIsListeningForCommand(false);
          }
        }, 500);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkRecording);
          if (voiceRecorderState?.isRecording) {
            voiceRecorderActions.stopRecording();
          }
          setIsListeningForCommand(false);
          setMessages(prev => prev.filter(m => !m.id.startsWith('listening-')));
        }, 10000);
      }
    } catch (err) {
      console.error('[DashOrb] Voice input error:', err);
      setIsListeningForCommand(false);
      setMessages(prev => prev.filter(m => !m.id.startsWith('listening-')));
    }
  };

  const handleMicPress = async () => {
    // Manual voice input (push-to-talk)
    if (isListeningForCommand) {
      // Stop listening
      if (voiceRecorderState?.isRecording) {
        await voiceRecorderActions?.stopRecording();
      }
      setIsListeningForCommand(false);
    } else {
      // Start listening
      await handleWakeWordDetected();
    }
  };

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (pendingTutorIntent) {
      const mergedPrompt = buildTutorPrompt(pendingTutorIntent.prompt, {
        topicHint: trimmed,
        requireDetails: false,
      });
      const label = pendingTutorIntent.label || 'Continue';
      setPendingTutorIntent(null);
      await processCommand(mergedPrompt, trimmed);
      return;
    }
    await processCommand(trimmed);
  };

  const processCommand = async (command: string, displayOverride?: string) => {
    // Sanitize input
    const sanitized = sanitizeInput(command, 2000);
    
    // Validate command
    const validation = validateCommand(sanitized);
    if (!validation.valid) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Invalid command: ${validation.error}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }
    
    // Check rate limit
    if (!rateLimiter.isAllowed('dashOrb')) {
      const remaining = rateLimiter.getRemaining('dashOrb');
      const errorMessage: ChatMessage = {
        id: `rate-limit-${Date.now()}`,
        role: 'assistant',
        content: `⏱️ Rate limit exceeded. Please wait a moment before trying again. (${remaining} requests remaining)`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }
    
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: displayOverride ? sanitizeInput(displayOverride, 2000) : sanitized,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsProcessing(true);
    setShowQuickActions(false);
    
    // Add thinking message
    const thinkingId = `thinking-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: thinkingId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
      toolCalls: detectToolsNeeded(command),
    }]);

    try {
      // Prepare history from previous messages
      // We filter out system messages and map to the format expected by the API
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));

      // Process the command
      const result = await executeCommand(command, history);
      
      // Replace thinking message with result
      setMessages(prev => prev.map(msg => 
        msg.id === thinkingId 
          ? { ...msg, content: result, isLoading: false, toolCalls: undefined }
          : msg
      ));
      
      // Speak the response if voice is enabled
      if (voiceEnabled && Platform.OS !== 'web') {
        const ttsLanguage = lastDetectedLanguage || 'en-ZA';
        await speak(result, ttsLanguage);
      }
      
      onCommandExecuted?.(command, result);
    } catch (error) {
      setMessages(prev => prev.map(msg => 
        msg.id === thinkingId 
          ? { ...msg, content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, isLoading: false }
          : msg
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  const detectToolsNeeded = (command: string): ChatMessage['toolCalls'] => {
    const tools: ChatMessage['toolCalls'] = [];
    const lowerCommand = command.toLowerCase();
    
    // DevOps tools
    if (lowerCommand.includes('build') || lowerCommand.includes('eas')) {
      tools.push({ name: 'eas_trigger_build', status: 'pending' });
    }
    if (lowerCommand.includes('commit') || lowerCommand.includes('git')) {
      tools.push({ name: 'github_get_commits', status: 'pending' });
    }
    if (lowerCommand.includes('pull request') || lowerCommand.includes('pr')) {
      tools.push({ name: 'github_list_prs', status: 'pending' });
    }
    
    // Platform analytics
    if (lowerCommand.includes('stat') || lowerCommand.includes('metric') || lowerCommand.includes('analytics')) {
      tools.push({ name: 'get_platform_stats', status: 'pending' });
    }
    if (lowerCommand.includes('ai usage') || lowerCommand.includes('token')) {
      tools.push({ name: 'get_ai_usage', status: 'pending' });
    }
    if (lowerCommand.includes('report') || lowerCommand.includes('revenue')) {
      tools.push({ name: 'generate_report', status: 'pending' });
    }
    
    // User/School management
    if (lowerCommand.includes('school') || lowerCommand.includes('preschool')) {
      tools.push({ name: 'list_schools', status: 'pending' });
    }
    if (lowerCommand.includes('user') || lowerCommand.includes('principal') || lowerCommand.includes('teacher')) {
      tools.push({ name: 'list_users', status: 'pending' });
    }
    
    // Database queries
    if (lowerCommand.includes('query') || lowerCommand.includes('select') || lowerCommand.includes('count')) {
      tools.push({ name: 'query_database', status: 'pending' });
    }
    
    // Feature flags
    if (lowerCommand.includes('feature') || lowerCommand.includes('flag')) {
      tools.push({ name: 'manage_feature_flag', status: 'pending' });
    }
    
    // Announcements
    if (lowerCommand.includes('announce') || lowerCommand.includes('broadcast')) {
      tools.push({ name: 'send_announcement', status: 'pending' });
    }
    
    return tools.length > 0 ? tools : [{ name: 'ai_analysis', status: 'pending' }];
  };

  /**
   * Execute command via AI Edge Function
   * Uses superadmin-ai for super admins, ai-proxy for regular users
   */
  const executeCommand = async (command: string, history: Array<{role: string, content: string}> = []): Promise<string> => {
    try {
      const supabase = assertSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated. Please log in again.');
      }
      
      // Choose endpoint based on user role
      const endpoint = isUserSuperAdmin 
        ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/superadmin-ai`
        : `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-proxy`;
      
      // Build request body based on endpoint
      const ageYears = (profile?.date_of_birth && ['student', 'learner'].includes(normalizedRole))
        ? calculateAge(profile.date_of_birth)
        : null;

      const ageContext = ageYears
        ? `User age: ${ageYears}. Provide age-appropriate, child-safe guidance.`
        : (['student', 'learner'].includes(normalizedRole) ? 'Provide age-appropriate, child-safe guidance.' : undefined);

      const roleContext = isTutorRole
        ? 'Role: Parent/Student tutor. Use diagnose → teach → practice. Start with one diagnostic question and WAIT. Ask one question at a time. Avoid teacher/admin-only sections.'
        : (normalizedRole ? `Role: ${normalizedRole}. Provide role-appropriate guidance.` : undefined);

      const lessonContext = isTutorRole
        ? 'If asked for a lesson plan, output a learner-ready mini-lesson with examples, practice, and a quick check question. Add 1-2 tips for parents to help at home.'
        : undefined;

      const requestBody = isUserSuperAdmin
        ? {
            action: 'chat',
            message: command,
            history: history,
            max_tokens: 1024,
          }
        : {
            scope: normalizedRole || 'parent',
            service_type: 'dash_conversation',
            payload: {
              prompt: command,
              context: [
                history.length > 0 ? history.map(h => `${h.role}: ${h.content}`).join('\n') : null,
                ageContext,
                roleContext,
                lessonContext,
              ].filter(Boolean).join('\n\n') || undefined,
            },
            stream: false,
            enable_tools: true,
            metadata: {
              role: normalizedRole,
              source: 'dash_orb',
              age_years: ageYears ?? undefined,
            }
          };
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Debug logging for response format
      console.log('[DashOrb] AI Response data:', JSON.stringify(data, null, 2).substring(0, 500));
      
      // Handle response format based on endpoint
      if (isUserSuperAdmin) {
        if (!data.success) {
          throw new Error(data.error || 'Unknown error occurred');
        }
        
        let formattedResponse = data.response;
        
        if (data.tool_calls && data.tool_calls.length > 0) {
          const toolNames = data.tool_calls.map((t: any) => t.name).join(', ');
          formattedResponse += `\n\n🔧 _Tools used: ${toolNames}_`;
        }
        
        if (data.tokens_used && data.tokens_used > 1000) {
          formattedResponse += `\n📊 _${data.tokens_used.toLocaleString()} tokens used_`;
        }
        
        return formattedResponse;
      } else {
        // ai-proxy response format - handle multiple possible response shapes
        // 1. Direct string content (most common)
        // 2. Anthropic format: content[0].text
        // 3. OpenAI format: message.content
        // 4. Legacy: text or response field
        let content: string;
        
        if (typeof data.content === 'string') {
          // Direct string content from ai-proxy
          content = data.content;
        } else if (Array.isArray(data.content) && data.content[0]?.text) {
          // Anthropic API format: content[0].text
          content = data.content[0].text;
        } else if (data.message?.content) {
          // OpenAI format
          content = data.message.content;
        } else if (data.text) {
          // Simple text field
          content = data.text;
        } else if (data.response) {
          // Legacy response field
          content = data.response;
        } else if (data.success && data.content) {
          // Success wrapper with content
          content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
        } else {
          console.warn('[DashOrb] Unknown response format:', Object.keys(data));
          content = 'I received your message but couldn\'t parse the response.';
        }
        
        return content;
      }
      
    } catch (error) {
      console.error('[DashOrb] Command execution error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('Not authenticated')) {
        return `⚠️ **Authentication Required**\n\nPlease log out and log back in to refresh your session.`;
      }
      
      if (errorMessage.includes('Super admin')) {
        return `🔒 **Access Denied**\n\nThis feature requires Super Admin privileges.`;
      }
      
      if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
        return `📊 **AI Quota Exceeded**\n\nYou've reached your AI usage limit. Please try again later or upgrade your subscription.`;
      }
      
      if (errorMessage.includes('ANTHROPIC_API_KEY')) {
        return `⚙️ **Configuration Required**\n\nThe AI service is not configured. Please contact support.`;
      }
      
      return `❌ **Error**\n\n${errorMessage}\n\nPlease try again or contact support if the issue persists.`;
    }
  };

  const isTutorRole = ['parent', 'student', 'learner'].includes(normalizedRole);

  const buildTutorPrompt = (basePrompt: string, options?: { topicHint?: string | null; requireDetails?: boolean }) => {
    const ageYears = profile?.date_of_birth ? calculateAge(profile.date_of_birth) : null;
    const autoAgeGroup = quickActionAge === 'auto' ? resolveAgeGroupFromYears(ageYears) : null;
    const effectiveAgeGroup = quickActionAge === 'auto' ? (autoAgeGroup || 'auto') : quickActionAge;

    const ageLabel = effectiveAgeGroup === 'adult'
      ? 'adult learners'
      : effectiveAgeGroup !== 'auto'
        ? `ages ${effectiveAgeGroup}`
        : (ageYears ? `age ${ageYears}` : '');
    const gradeBand = effectiveAgeGroup !== 'auto' ? resolveGradeBand(effectiveAgeGroup) : null;
    const learnerHint = gradeBand
      ? `${gradeBand}${ageLabel ? ` (${ageLabel})` : ''}`
      : (ageLabel || '');

    const roleDirective = isTutorRole
      ? 'Audience: parent/student. Use tutoring mode. Avoid teacher/admin-only sections. If generating a lesson, make it learner-ready with examples and practice plus 2 parent tips.'
      : normalizedRole
        ? `Audience: ${normalizedRole}. Provide role-appropriate guidance.`
        : 'Audience: general.';

    const interactionRules = isTutorRole
      ? 'Diagnose → Teach → Practice loop. Start with ONE short diagnostic question and WAIT. Ask one question at a time; do not proceed until the learner answers.'
      : 'Be concise and practical. Ask 1–2 clarifying questions if needed.';

    const detailRule = options?.requireDetails
      ? 'If topic or grade is missing, ask: "Which grade and topic should I use?" and wait.'
      : '';

    return [
      'Start a NEW topic and ignore earlier context.',
      basePrompt,
      roleDirective,
      learnerHint ? `Learner profile: ${learnerHint}.` : '',
      options?.topicHint ? `Topic: ${options.topicHint}.` : '',
      interactionRules,
      detailRule,
    ].filter(Boolean).join(' ');
  };

  const handleQuickAction = (action: QuickAction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const customHint = quickActionPrompt.trim();
    const tutorBasePrompt = isTutorRole ? (() => {
      switch (action.id) {
        case 'gen-lesson':
          return 'Create a learner-friendly mini lesson (not a teacher lesson plan).';
        case 'gen-stem':
          return 'Design a hands-on STEM activity a parent/student can do at home.';
        case 'gen-curriculum':
          return 'Create a 4-week learning path for a learner with weekly goals and simple activities.';
        case 'gen-worksheet':
          return 'Create a short student worksheet with worked examples and answers.';
        case 'gen-digital':
          return 'Create a digital skills mini lesson for a learner.';
        default:
          return action.command;
      }
    })() : action.command;

    const topicHint = customHint || (!isTutorRole ? action.defaultTopic : null);
    const needsDetails = isTutorRole && !customHint;

    if (action.category === 'education' && needsDetails) {
      setPendingTutorIntent({ prompt: tutorBasePrompt, label: action.label });
      setShowQuickActions(false);
      setMessages(prev => [...prev, {
        id: `clarify-${Date.now()}`,
        role: 'assistant',
        content: 'Great — which grade and topic should I use?',
        timestamp: new Date(),
      }]);
      return;
    }

    const enhancedCommand = action.category === 'education'
      ? buildTutorPrompt(tutorBasePrompt, {
          topicHint: topicHint || undefined,
          requireDetails: false,
        })
      : [
          'Start a NEW topic and ignore earlier context.',
          action.command,
          customHint ? `Additional details: ${customHint}` : '',
        ].filter(Boolean).join(' ');

    processCommand(enhancedCommand, `${action.label}${customHint ? ` · ${customHint}` : ''}`);
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <>
      {/* Floating Orb Button */}
      <Animated.View
        style={[
          styles.orbContainer,
          {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: pulseAnim }
            ],
            // Remove fixed positioning as we use transform
            bottom: undefined,
            right: undefined,
            left: undefined,
            top: undefined,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={handleOrbPress}
          activeOpacity={0.9}
          style={{ width: size, height: size }}
        >
          <CosmicOrb size={size} isProcessing={isProcessing} isSpeaking={isSpeaking} />
          
          {/* Center icon */}
          <View
            style={{
              position: 'absolute',
              width: size,
              height: size,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons 
              name={isSpeaking ? 'mic' : isProcessing ? 'sync' : 'sparkles'} 
              size={size * 0.35} 
              color="#ffffff" 
            />
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Expanded Chat Modal */}
      <ChatModal
        visible={isExpanded}
        onClose={() => setIsExpanded(false)}
        messages={messages}
        inputText={inputText}
        setInputText={setInputText}
        onSend={handleSend}
        isProcessing={isProcessing}
        showQuickActions={showQuickActions}
        onQuickAction={handleQuickAction}
        quickActionAge={quickActionAge}
        onQuickActionAgeChange={setQuickActionAge}
        quickActionPrompt={quickActionPrompt}
        onQuickActionPromptChange={setQuickActionPrompt}
        onSendPrompt={(prompt, label) => {
          const customHint = quickActionPrompt.trim();
          const needsDetails = isTutorRole && !customHint;
          if (needsDetails) {
            setPendingTutorIntent({ prompt, label });
            setShowQuickActions(false);
            setMessages(prev => [...prev, {
              id: `clarify-${Date.now()}`,
              role: 'assistant',
              content: 'Great — which grade and topic should I use?',
              timestamp: new Date(),
            }]);
            return;
          }
          const enhanced = buildTutorPrompt(prompt, {
            topicHint: customHint || undefined,
            requireDetails: false,
          });
          processCommand(enhanced, label || customHint || 'Quick action');
        }}
        onBackToQuickActions={() => {
          setShowQuickActions(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        isSpeaking={isSpeaking}
        voiceEnabled={voiceEnabled}
        onToggleVoice={() => {
          setVoiceEnabled(!voiceEnabled);
          if (isSpeaking) stopSpeaking();
        }}
        isListeningForCommand={isListeningForCommand}
        onMicPress={handleMicPress}
        wakeWordEnabled={wakeWordEnabled}
        onToggleWakeWord={() => {
          const newState = !wakeWordEnabled;
          setWakeWordEnabled(newState);
          if (newState) {
            wakeWord.startListening();
          } else {
            wakeWord.stopListening();
          }
        }}
        onOpenSettings={() => router.push('/screens/dash-ai-settings' as any)}
      />
    </>
  );
}
