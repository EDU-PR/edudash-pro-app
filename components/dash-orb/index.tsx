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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { assertSupabase } from '../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { DASH_WELCOME_MESSAGE } from '../../lib/ai/constants';
import { styles } from './DashOrb.styles';
import { ChatModal, ChatMessage } from './ChatModal';
import { QuickAction } from './QuickActions';
import { useVoiceTTS } from '../super-admin/voice-orb/useVoiceTTS';
import { useVoiceRecorder } from '../super-admin/voice-orb/useVoiceRecorder';
import { useVoiceSTT } from '../super-admin/voice-orb/useVoiceSTT';
import { useWakeWord } from '../../hooks/useWakeWord';
import { CosmicOrb } from './CosmicOrb';
import { sanitizeInput, validateCommand, RateLimiter } from '../../lib/security/validators';

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
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isListeningForCommand, setIsListeningForCommand] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  
  // Rate limiter for commands (10 requests per minute)
  const rateLimiter = useRef(new RateLimiter(10, 60000)).current;
  
  // Voice TTS integration
  const { speak, stop: stopSpeaking, isSpeaking } = Platform.OS !== 'web' ? useVoiceTTS() : { speak: async () => {}, stop: async () => {}, isSpeaking: false };
  
  // Voice input integration - useVoiceRecorder returns [state, actions, audioLevel] tuple
  const voiceRecorderResult = Platform.OS !== 'web' ? useVoiceRecorder() : null;
  const voiceRecorderState = voiceRecorderResult ? voiceRecorderResult[0] : null;
  const voiceRecorderActions = voiceRecorderResult ? voiceRecorderResult[1] : null;
  const voiceSTT = Platform.OS !== 'web' ? useVoiceSTT() : null;
  
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
      // Add welcome message with comprehensive capabilities
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: DASH_WELCOME_MESSAGE,
        timestamp: new Date(),
      }]);
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
              const transcriptResult = await voiceSTT.transcribe(audioUri, 'en-ZA');
              
              if (transcriptResult && transcriptResult.text && transcriptResult.text.trim()) {
                // Remove listening message
                setMessages(prev => prev.filter(m => !m.id.startsWith('listening-')));
                
                // Process the voice command
                await processCommand(transcriptResult.text);
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

  const processCommand = async (command: string) => {
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
      content: sanitized,
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
        await speak(result);
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
   * Execute command via superadmin-ai Edge Function
   * This connects to the real AI backend with full tool capabilities
   */
  const executeCommand = async (command: string, history: Array<{role: string, content: string}> = []): Promise<string> => {
    try {
      const supabase = assertSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated. Please log in again.');
      }
      
      // Call the superadmin-ai Edge Function
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/superadmin-ai`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'chat',
            message: command,
            history: history,
            max_tokens: 1024, // Shorter, faster responses
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Unknown error occurred');
      }
      
      // Format the response nicely
      let formattedResponse = data.response;
      
      // Add tool call info if available
      if (data.tool_calls && data.tool_calls.length > 0) {
        const toolNames = data.tool_calls.map((t: any) => t.name).join(', ');
        formattedResponse += `\n\n🔧 _Tools used: ${toolNames}_`;
      }
      
      // Add token usage if significant
      if (data.tokens_used && data.tokens_used > 1000) {
        formattedResponse += `\n📊 _${data.tokens_used.toLocaleString()} tokens used_`;
      }
      
      return formattedResponse;
      
    } catch (error) {
      console.error('[DashOrb] Command execution error:', error);
      
      // Return helpful error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('Not authenticated')) {
        return `⚠️ **Authentication Required**\n\nPlease log out and log back in to refresh your session.`;
      }
      
      if (errorMessage.includes('Super admin')) {
        return `🔒 **Access Denied**\n\nThis feature requires Super Admin privileges.`;
      }
      
      if (errorMessage.includes('ANTHROPIC_API_KEY')) {
        return `⚙️ **Configuration Required**\n\nThe AI service is not configured. Please set up the ANTHROPIC_API_KEY in Supabase secrets.`;
      }
      
      return `❌ **Error**\n\n${errorMessage}\n\nPlease try again or contact support if the issue persists.`;
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // All quick actions now go directly to the AI
    processCommand(action.command);
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
        onSend={processCommand}
        isProcessing={isProcessing}
        showQuickActions={showQuickActions}
        onQuickAction={handleQuickAction}
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
      />
    </>
  );
}
