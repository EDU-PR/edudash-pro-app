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
  Text,
  Platform,
  Share,
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
import { formatTranscript } from '@/lib/voice/formatTranscript';
import { useWakeWord } from '../../hooks/useWakeWord';
import { CosmicOrb } from './CosmicOrb';
import { sanitizeInput, validateCommand, RateLimiter } from '../../lib/security/validators';
import { useAuth } from '../../contexts/AuthContext';
import { isSuperAdmin } from '../../lib/roleUtils';
import { calculateAge } from '../../lib/date-utils';
import * as Clipboard from 'expo-clipboard';
import { toast } from '@/components/ui/ToastProvider';

let AsyncStorage: any = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch {
  AsyncStorage = null;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DashOrbProps {
  /** Position of the orb */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Size of the orb */
  size?: number;
  /** Callback when a command is executed */
  onCommandExecuted?: (command: string, result: unknown) => void;
  /** Start expanded (useful for full-screen mode) */
  autoOpen?: boolean;
  /** Hide floating button (useful for full-screen mode) */
  hideButton?: boolean;
  /** Optional learner context for parent tutoring */
  learnerContext?: {
    ageYears?: number | null;
    grade?: string | null;
    name?: string | null;
    schoolType?: string | null;
  };
  /** Lock the orb and show upgrade prompt instead of chat */
  locked?: boolean;
  /** Optional title/message for locked prompt */
  lockedTitle?: string;
  lockedMessage?: string;
  lockedCtaLabel?: string;
  onUpgradePress?: () => void;
}

export default function DashOrb({
  position = 'bottom-right',
  size = 60,
  onCommandExecuted,
  autoOpen = false,
  hideButton = false,
  learnerContext,
  locked = false,
  lockedTitle,
  lockedMessage,
  lockedCtaLabel,
  onUpgradePress,
}: DashOrbProps) {
  // Get user profile for role-based AI endpoint selection
  const { profile, user } = useAuth();
  const userRole = profile?.role?.toLowerCase() || '';
  const normalizedRole = userRole || 'parent';
  const isUserSuperAdmin = isSuperAdmin(normalizedRole);
  const learnerAgeYears = typeof learnerContext?.ageYears === 'number' ? learnerContext.ageYears : null;
  const learnerGrade = learnerContext?.grade || null;
  const learnerName = learnerContext?.name || null;
  
  const [isExpanded, setIsExpanded] = useState(!!autoOpen);
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
  const wakeWordAvailable = Platform.OS !== 'web' && !!process.env.EXPO_PUBLIC_PICOVOICE_ACCESS_KEY;
  const streamingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [showUpgradeBubble, setShowUpgradeBubble] = useState(false);
  const upgradeAnim = useRef(new Animated.Value(0)).current;
  const upgradeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

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
    enabled: wakeWordEnabled && wakeWordAvailable && !locked,
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

  useEffect(() => {
    if (autoOpen && !locked) {
      setIsExpanded(true);
    }
  }, [autoOpen, locked]);

  useEffect(() => {
    return () => {
      if (upgradeTimerRef.current) {
        clearTimeout(upgradeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!locked) {
      setShowUpgradeBubble(false);
      upgradeAnim.setValue(0);
    }
  }, [locked, upgradeAnim]);

  const chatStorageKey = user?.id ? `@dash_orb_chat_${user.id}` : '@dash_orb_chat_guest';

  useEffect(() => {
    if (!AsyncStorage) return;
    let isMounted = true;
    const loadHistory = async () => {
      try {
        const stored = await AsyncStorage.getItem(chatStorageKey);
        if (!stored) {
          return;
        }
        const parsed = JSON.parse(stored) as Array<Omit<ChatMessage, 'timestamp'> & { timestamp: string }>;
        if (!Array.isArray(parsed)) return;
        const hydrated = parsed.map((msg) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
          isLoading: false,
          isStreaming: false,
        })) as ChatMessage[];
        if (isMounted) {
          setMessages(hydrated);
          setShowQuickActions(hydrated.length === 0);
        }
      } catch (err) {
        console.warn('[DashOrb] Failed to load chat history:', err);
      }
    };
    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [chatStorageKey]);

  useEffect(() => {
    if (!AsyncStorage) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    saveTimerRef.current = setTimeout(async () => {
      try {
        const serializable = messages
          .filter((msg) => !msg.isLoading)
          .map((msg) => ({
            ...msg,
            isLoading: false,
            isStreaming: false,
            toolCalls: undefined,
            timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : new Date().toISOString(),
          }));
        await AsyncStorage.setItem(chatStorageKey, JSON.stringify(serializable));
      } catch (err) {
        console.warn('[DashOrb] Failed to save chat history:', err);
      }
    }, 400);
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [messages, chatStorageKey]);

  useEffect(() => {
    return () => {
      if (streamingTimerRef.current) {
        clearTimeout(streamingTimerRef.current);
        streamingTimerRef.current = null;
      }
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, []);

  const streamResponseToMessage = async (messageId: string, fullText: string) => {
    if (streamingTimerRef.current) {
      clearTimeout(streamingTimerRef.current);
      streamingTimerRef.current = null;
    }

    if (!fullText) {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId ? { ...msg, content: '', isLoading: false, isStreaming: false } : msg
        )
      );
      return;
    }

    const total = fullText.length;
    const step = 24;
    const intervalMs = 18;
    let index = 0;

    return new Promise<void>((resolve) => {
      const tick = () => {
        index = Math.min(total, index + step);
        setMessages(prev =>
          prev.map(msg =>
            msg.id === messageId
              ? {
                  ...msg,
                  content: fullText.slice(0, index),
                  isLoading: false,
                  isStreaming: index < total,
                }
              : msg
          )
        );
        if (index >= total) {
          streamingTimerRef.current = null;
          resolve();
          return;
        }
        streamingTimerRef.current = setTimeout(tick, intervalMs);
      };
      tick();
    });
  };

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

        if (showUpgradeBubble) {
          if (upgradeTimerRef.current) {
            clearTimeout(upgradeTimerRef.current);
            upgradeTimerRef.current = null;
          }
          upgradeAnim.stopAnimation();
          upgradeAnim.setValue(1);
        }
        
        dragStartRef.current = {
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        };
        pan.setOffset({ ...dragStartRef.current });
        pan.setValue({ x: 0, y: 0 });
        
        // Haptic feedback on grab
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        // Scale down slightly when dragging
        Animated.spring(pulseAnim, {
          toValue: 0.9,
          useNativeDriver: false,
        }).start();
      },
      onPanResponderMove: (_, gestureState) => {
        const edgePadding = 16;
        const topLimit = 80;
        const bottomLimit = 120;
        const horizontalLimit = SCREEN_WIDTH * 0.42;
        const minX = position.includes('left') ? edgePadding : Math.max(edgePadding, horizontalLimit);
        const maxX = position.includes('left')
          ? Math.min(SCREEN_WIDTH * 0.58 - size, SCREEN_WIDTH - size - edgePadding)
          : SCREEN_WIDTH - size - edgePadding;
        const minY = topLimit;
        const maxY = SCREEN_HEIGHT - size - bottomLimit;

        const rawX = dragStartRef.current.x + gestureState.dx;
        const rawY = dragStartRef.current.y + gestureState.dy;
        const clampedX = Math.max(minX, Math.min(maxX, rawX));
        const clampedY = Math.max(minY, Math.min(maxY, rawY));

        pan.setValue({
          x: clampedX - dragStartRef.current.x,
          y: clampedY - dragStartRef.current.y,
        });
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        setIsDragging(false);

        if (locked && showUpgradeBubble) {
          if (upgradeTimerRef.current) {
            clearTimeout(upgradeTimerRef.current);
          }
          upgradeTimerRef.current = setTimeout(() => {
            Animated.timing(upgradeAnim, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }).start(() => setShowUpgradeBubble(false));
          }, 2600);
        }
        
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

    if (locked) {
      if (upgradeTimerRef.current) {
        clearTimeout(upgradeTimerRef.current);
      }
      setShowUpgradeBubble(true);
      Animated.timing(upgradeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
      upgradeTimerRef.current = setTimeout(() => {
        Animated.timing(upgradeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setShowUpgradeBubble(false));
      }, 3600);
      return;
    }
    
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
    if (locked) {
      if (upgradeTimerRef.current) {
        clearTimeout(upgradeTimerRef.current);
      }
      setShowUpgradeBubble(true);
      Animated.timing(upgradeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
      upgradeTimerRef.current = setTimeout(() => {
        Animated.timing(upgradeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setShowUpgradeBubble(false));
      }, 3600);
      return;
    }
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
                const formatted = formatTranscript(
                  transcriptResult.text,
                  transcriptResult.language || normalized || undefined
                );
                await handleSend(formatted);
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

  const handleOrbAttach = () => {
    toast.info('Attachments are available in the full Dash Tutor screen for now.');
  };

  const handleOrbCamera = () => {
    toast.info('Camera upload is available in the full Dash Tutor screen for now.');
  };

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (isEditing && editingMessageId) {
      const index = messages.findIndex((m) => m.id === editingMessageId);
      const baseMessages = index >= 0 ? messages.slice(0, index) : messages;
      setIsEditing(false);
      setEditingMessageId(null);
      await processCommand(trimmed, undefined, { baseMessages });
      return;
    }
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

  const processCommand = async (
    command: string,
    displayOverride?: string,
    options?: {
      baseMessages?: ChatMessage[];
      historyOverride?: Array<{ role: string; content: string }>;
      skipUserMessage?: boolean;
    }
  ) => {
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
    setInputText('');
    setIsProcessing(true);
    setShowQuickActions(false);
    
    const thinkingId = `thinking-${Date.now()}`;
    setMessages((prev) => {
      const base = options?.baseMessages ?? prev;
      const next = [...base];
      if (!options?.skipUserMessage) {
        next.push(userMessage);
      }
      next.push({
        id: thinkingId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isLoading: true,
        toolCalls: detectToolsNeeded(command),
      });
      return next;
    });

    try {
      const history = options?.historyOverride ?? (options?.baseMessages ?? messages)
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));

      // Process the command
      const result = await executeCommand(command, history);
      
      // Replace thinking message with result
      await streamResponseToMessage(thinkingId, result);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === thinkingId ? { ...msg, toolCalls: undefined } : msg
        )
      );
      
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
      const isLearnerRole = ['student', 'learner'].includes(normalizedRole);
      const ageYears = isLearnerRole
        ? (profile?.date_of_birth ? calculateAge(profile.date_of_birth) : null)
        : (normalizedRole === 'parent' ? learnerAgeYears : null);

      const ageContext = ageYears
        ? `Learner age: ${ageYears}. Provide age-appropriate, child-safe guidance.`
        : (isLearnerRole ? 'Provide age-appropriate, child-safe guidance.' : undefined);
      const gradeContext = learnerGrade ? `Learner grade: ${learnerGrade}.` : undefined;
      const nameContext = learnerName ? `Learner name: ${learnerName}.` : undefined;
      const schoolTypeContext = learnerContext?.schoolType ? `School type: ${learnerContext.schoolType}.` : undefined;

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
                nameContext,
                gradeContext,
                schoolTypeContext,
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
        const rawError = errorData.error || errorData.message || `Request failed: ${response.status}`;
        console.warn('[DashOrb] AI proxy error payload:', errorData);
        if (typeof rawError === 'string' && rawError.toLowerCase().includes('ai_proxy_error')) {
          throw new Error('AI service is temporarily unavailable. Please try again shortly.');
        }
        throw new Error(rawError);
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
    const ageYears = ['student', 'learner'].includes(normalizedRole)
      ? (profile?.date_of_birth ? calculateAge(profile.date_of_birth) : null)
      : learnerAgeYears;
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
      learnerGrade ? `Learner grade: ${learnerGrade}.` : '',
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
      {!hideButton && (
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
          {locked && (
            <Animated.View
              pointerEvents={showUpgradeBubble ? 'auto' : 'none'}
              style={[
                styles.upgradeBubble,
                position.includes('right')
                  ? { right: size + 14 }
                  : { left: size + 14 },
                { top: size * 0.12 },
                {
                  opacity: upgradeAnim,
                  transform: [
                    {
                      translateX: upgradeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: position.includes('right') ? [12, 0] : [-12, 0],
                      }),
                    },
                    {
                      scale: upgradeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.96, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.upgradeBubbleTitle}>
                {lockedTitle || 'Dash Orb Locked'}
              </Text>
              <Text style={styles.upgradeBubbleText}>
                {lockedMessage || 'Upgrade to Parent Plus to unlock the Dash Orb.'}
              </Text>
              <View style={styles.upgradeBubbleActions}>
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={() => {
                    if (upgradeTimerRef.current) {
                      clearTimeout(upgradeTimerRef.current);
                      upgradeTimerRef.current = null;
                    }
                    setShowUpgradeBubble(false);
                    Animated.timing(upgradeAnim, {
                      toValue: 0,
                      duration: 160,
                      useNativeDriver: true,
                    }).start();
                    if (onUpgradePress) {
                      onUpgradePress();
                    } else {
                      router.push('/screens/subscription-setup');
                    }
                  }}
                >
                  <Text style={styles.upgradeButtonText}>
                    {lockedCtaLabel || 'Upgrade'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
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
            {locked && (
              <View
                style={[
                  styles.lockBadge,
                  {
                    width: size * 0.32,
                    height: size * 0.32,
                    borderRadius: size * 0.16,
                  },
                ]}
              >
                <Ionicons name="lock-closed" size={size * 0.18} color="#ffffff" />
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Expanded Chat Modal */}
      <ChatModal
        visible={isExpanded}
        onClose={() => {
          setIsExpanded(false);
          if (hideButton) {
            router.back();
          }
        }}
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
          setShowQuickActions(prev => !prev);
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
          if (!wakeWordEnabled && !wakeWordAvailable) {
            setMessages(prev => [...prev, {
              id: `wakeword-unavailable-${Date.now()}`,
              role: 'system',
              content: 'Wake word requires a Picovoice access key. Add EXPO_PUBLIC_PICOVOICE_ACCESS_KEY to enable "Hey Dash".',
              timestamp: new Date(),
            }]);
            return;
          }
          const newState = !wakeWordEnabled;
          setWakeWordEnabled(newState);
          if (newState) {
            wakeWord.startListening();
          } else {
            wakeWord.stopListening();
          }
        }}
        onOpenSettings={() => router.push('/screens/dash-ai-settings' as any)}
        onAttachFile={handleOrbAttach}
        onTakePhoto={handleOrbCamera}
        attachmentCount={0}
        inlineReplyEnabled={isTutorRole}
        onCopyMessage={async (message) => {
          try {
            const content = message.content || '';
            if (Clipboard?.setStringAsync) {
              await Clipboard.setStringAsync(content);
            } else if (typeof navigator !== 'undefined' && (navigator as any).clipboard?.writeText) {
              await (navigator as any).clipboard.writeText(content);
            }
            toast.success('Copied to clipboard');
          } catch (err) {
            console.warn('[DashOrb] Copy failed:', err);
            toast.error('Copy failed');
          }
        }}
        onShareMessage={async (message) => {
          try {
            await Share.share({ message: message.content || '' });
          } catch (err) {
            console.warn('[DashOrb] Share failed:', err);
          }
        }}
        onEditMessage={(message) => {
          if (isProcessing) return;
          if (message.role !== 'user') return;
          setInputText(message.content);
          setIsEditing(true);
          setEditingMessageId(message.id);
          setShowQuickActions(false);
        }}
        onRegenerateMessage={(message) => {
          if (isProcessing) return;
          const targetIndex = messages.findIndex((m) => m.id === message.id);
          if (targetIndex === -1) return;
          let userIndex = -1;
          for (let i = targetIndex; i >= 0; i -= 1) {
            if (messages[i].role === 'user') {
              userIndex = i;
              break;
            }
          }
          if (userIndex === -1) return;
          const lastUserMessage = messages[userIndex];
          const baseMessages = messages.slice(0, userIndex + 1);
          const historyOverride = messages.slice(0, userIndex)
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({ role: m.role, content: m.content }));
          processCommand(lastUserMessage.content, undefined, {
            baseMessages,
            historyOverride,
            skipUserMessage: true,
          });
        }}
        onFeedback={(message, rating) => {
          toast.success(rating === 'up' ? 'Thanks for the feedback!' : 'Feedback noted.');
        }}
        onNewChat={async () => {
          setMessages([]);
          setShowQuickActions(true);
          setInputText('');
          setIsEditing(false);
          setEditingMessageId(null);
          if (AsyncStorage) {
            try { await AsyncStorage.removeItem(chatStorageKey); } catch {}
          }
        }}
        onExportChat={async () => {
          const transcript = messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => `${m.role === 'user' ? 'You' : 'Dash'}: ${m.content}`)
            .join('\n\n');
          try {
            await Share.share({ message: transcript || 'No messages yet.' });
          } catch (err) {
            console.warn('[DashOrb] Export failed:', err);
          }
        }}
        onOpenHistory={() => router.push('/screens/dash-conversations-history' as any)}
        isEditing={isEditing}
        onCancelEdit={() => {
          setIsEditing(false);
          setEditingMessageId(null);
        }}
      />
    </>
  );
}
