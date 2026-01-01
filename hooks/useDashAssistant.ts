/**
 * useDashAssistant Hook
 * 
 * Custom hook that extracts business logic from DashAssistant component.
 * Handles message state, conversation management, attachments, and AI interactions.
 * Voice input enabled for paid tier users (Starter, Plus).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform, PermissionsAndroid, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { AudioModule } from 'expo-audio';

import type { DashMessage, DashConversation, DashAttachment } from '@/services/dash-ai/types';
import type { IDashAIAssistant } from '@/services/dash-ai/DashAICompat';
import { useDashboardPreferences } from '@/contexts/DashboardPreferencesContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { 
  pickDocuments, 
  pickImages,
  takePhoto,
  uploadAttachment
} from '@/services/AttachmentService';
import { track } from '@/lib/analytics';
import { checkAIQuota, showQuotaExceededAlert } from '@/lib/ai/guards';
import type { AIQuotaFeature } from '@/lib/ai/limits';
import { getSingleUseVoiceProvider, type VoiceSession, type VoiceProvider } from '@/lib/voice/unifiedProvider';

interface UseDashAssistantOptions {
  conversationId?: string;
  initialMessage?: string;
  onClose?: () => void;
}

interface UseDashAssistantReturn {
  // State
  messages: DashMessage[];
  inputText: string;
  setInputText: (text: string) => void;
  isLoading: boolean;
  loadingStatus: 'uploading' | 'thinking' | 'responding' | null;
  streamingMessageId: string | null;
  streamingContent: string;
  isSpeaking: boolean;
  speakingMessageId: string | null;
  conversation: DashConversation | null;
  dashInstance: IDashAIAssistant | null;
  isInitialized: boolean;
  enterToSend: boolean;
  setEnterToSend: (value: boolean) => void;
  selectedAttachments: DashAttachment[];
  isUploading: boolean;
  isNearBottom: boolean;
  setIsNearBottom: (value: boolean) => void;
  unreadCount: number;
  setUnreadCount: (value: number | ((prev: number) => number)) => void;
  
  // Voice input state
  isRecording: boolean;
  partialTranscript: string;
  
  // Refs
  flashListRef: React.RefObject<any>;
  inputRef: React.RefObject<any>;
  
  // Actions
  sendMessage: (text?: string) => Promise<void>;
  speakResponse: (message: DashMessage) => Promise<void>;
  stopSpeaking: () => Promise<void>;
  scrollToBottom: (opts?: { animated?: boolean; delay?: number }) => void;
  handleAttachFile: () => Promise<void>;
  handlePickDocuments: () => Promise<void>;
  handlePickImages: () => Promise<void>;
  handleTakePhoto: () => Promise<void>;
  handleRemoveAttachment: (attachmentId: string) => Promise<void>;
  handleInputMicPress: () => Promise<void>;
  stopVoiceRecording: () => Promise<void>;
  startNewConversation: () => Promise<void>;
  
  // Helpers
  extractFollowUps: (text: string) => string[];
  wantsLessonGenerator: (t: string, assistantText?: string) => boolean;
  
  // Subscription info
  tier: string | undefined;
  subReady: boolean;
  refreshTier: () => void;
}

const DASH_AI_SERVICE_TYPE: AIQuotaFeature = 'homework_help';

export function useDashAssistant(options: UseDashAssistantOptions): UseDashAssistantReturn {
  const { conversationId, initialMessage, onClose } = options;
  const { setLayout } = useDashboardPreferences();
  const { tier, ready: subReady, refresh: refreshTier } = useSubscription();
  const { user } = useAuth();
  
  // State
  const [messages, setMessages] = useState<DashMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<'uploading' | 'thinking' | 'responding' | null>(null);
  const [statusStartTime, setStatusStartTime] = useState<number>(0);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<DashConversation | null>(null);
  const [dashInstance, setDashInstance] = useState<IDashAIAssistant | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [enterToSend, setEnterToSend] = useState(true);
  const [selectedAttachments, setSelectedAttachments] = useState<DashAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Voice input state
  const [isRecording, setIsRecording] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const voiceSessionRef = useRef<VoiceSession | null>(null);
  const voiceProviderRef = useRef<VoiceProvider | null>(null);
  
  // Refs
  const flashListRef = useRef<any>(null);
  const inputRef = useRef<any>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestQueueRef = useRef<Array<{ text: string; attachments: DashAttachment[] }>>([]);
  const isProcessingRef = useRef(false);
  const prevLengthRef = useRef<number>(0);

  // Scroll utility
  const scrollToBottom = useCallback((opts?: { animated?: boolean; delay?: number }) => {
    const delay = opts?.delay ?? 120;
    const animated = opts?.animated ?? true;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }

    scrollTimeoutRef.current = setTimeout(() => {
      try {
        const lastIndex = Math.max(0, (messages?.length || 1) - 1);
        flashListRef.current?.scrollToIndex({ index: lastIndex, animated });
      } catch (e) {
        console.debug('[useDashAssistant] scrollToIndex failed:', e);
      }
    }, delay);
  }, [messages?.length]);

  // Helper functions
  const wantsLessonGenerator = useCallback((t: string, assistantText?: string): boolean => {
    const rx = /(create|plan|generate)\s+(a\s+)?lesson(\s+plan)?|lesson\s+plan|teach\s+.*(about|on)/i;
    if (rx.test(t)) return true;
    if (assistantText && rx.test(assistantText)) return true;
    return false;
  }, []);

  const extractFollowUps = useCallback((text: string): string[] => {
    try {
      const lines = (text || '').split(/\n+/);
      const results: string[] = [];
      for (const line of lines) {
        const m = line.match(/^\s*User:\s*(.+)$/i);
        if (m && m[1]) {
          const q = m[1].trim();
          if (q.length > 0) results.push(q);
        }
      }
      return results;
    } catch {
      return [];
    }
  }, []);

  // Attachment progress updater
  const updateAttachmentProgress = useCallback((attachmentId: string, progress: number, status?: DashAttachment['status']) => {
    setSelectedAttachments(prev => prev.map(att => 
      att.id === attachmentId 
        ? { ...att, uploadProgress: progress, ...(status && { status }) }
        : att
    ));
  }, []);

  // Internal message sender
  const sendMessageInternal = useCallback(async (text: string, attachments: DashAttachment[]) => {
    if (!dashInstance) return;

    try {
      setIsLoading(true);
      scrollToBottom({ animated: true, delay: 120 });
      
      if (attachments.length > 0) {
        setLoadingStatus('uploading');
        setStatusStartTime(Date.now());
        setIsUploading(true);
      } else {
        setLoadingStatus('thinking');
        setStatusStartTime(Date.now());
      }

      // Upload attachments
      const uploadedAttachments: DashAttachment[] = [];
      if (attachments.length > 0 && conversation?.id) {
        for (const attachment of attachments) {
          try {
            updateAttachmentProgress(attachment.id, 0, 'uploading');
            const uploaded = await uploadAttachment(
              attachment, 
              conversation.id,
              (progress) => updateAttachmentProgress(attachment.id, progress)
            );
            updateAttachmentProgress(attachment.id, 100, 'uploaded');
            uploadedAttachments.push(uploaded);
          } catch (error) {
            console.error(`Failed to upload ${attachment.name}:`, error);
            updateAttachmentProgress(attachment.id, 0, 'failed');
            Alert.alert('Upload Failed', `Failed to upload ${attachment.name}. Please try again.`);
          }
        }
      }

      setIsUploading(false);
      setLoadingStatus('thinking');
      setStatusStartTime(Date.now());
      scrollToBottom({ animated: true, delay: 120 });

      const userText = text || 'Attached files';
      const streamingEnabled = Platform.OS === 'web' && 
        (process.env.EXPO_PUBLIC_AI_STREAMING_ENABLED === 'true' || 
         process.env.EXPO_PUBLIC_ENABLE_AI_STREAMING === 'true');
      
      let response: DashMessage;
      
      if (streamingEnabled) {
        const tempStreamingMsgId = `streaming_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setStreamingMessageId(tempStreamingMsgId);
        setStreamingContent('');
        
        const tempStreamingMessage: DashMessage = {
          id: tempStreamingMsgId,
          type: 'assistant',
          content: '',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, tempStreamingMessage]);
        
        response = await dashInstance.sendMessage(
          userText, 
          undefined, 
          uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
          (chunk: string) => {
            setStreamingContent(prev => {
              const newContent = prev + chunk;
              setMessages(prevMessages => 
                prevMessages.map(msg => 
                  msg.id === tempStreamingMsgId 
                    ? { ...msg, content: newContent }
                    : msg
                )
              );
              return newContent;
            });
            scrollToBottom({ animated: true, delay: 60 });
          }
        );
        
        setStreamingMessageId(null);
        setStreamingContent('');
        setMessages(prev => prev.filter(msg => msg.id !== tempStreamingMsgId));
      } else {
        response = await dashInstance.sendMessage(
          userText, 
          undefined, 
          uploadedAttachments.length > 0 ? uploadedAttachments : undefined
        );
      }
      
      setLoadingStatus('responding');
      setStatusStartTime(Date.now());
      scrollToBottom({ animated: true, delay: 120 });
      
      // Handle dashboard actions
      if (response.metadata?.dashboard_action?.type === 'switch_layout') {
        const newLayout = response.metadata.dashboard_action.layout;
        if (newLayout && (newLayout === 'classic' || newLayout === 'enhanced')) {
          setLayout(newLayout);
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch {}
        }
      } else if (response.metadata?.dashboard_action?.type === 'open_screen') {
        const { route, params } = response.metadata.dashboard_action as any;
        if (typeof route === 'string' && route.includes('/screens/ai-lesson-generator')) {
          Alert.alert(
            'Open Lesson Generator?',
            'Dash suggests opening the AI Lesson Generator with prefilled details.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open', onPress: () => { try { router.push({ pathname: route, params } as any); } catch {} } },
            ]
          );
        } else {
          try { router.push({ pathname: route, params } as any); } catch {}
        }
      }
      
      // Update messages
      const updatedConv = await dashInstance.getConversation(dashInstance.getCurrentConversationId()!);
      if (updatedConv) {
        setMessages(updatedConv.messages);
        setConversation(updatedConv);
        scrollToBottom({ animated: true, delay: 150 });
      }

      // Check for lesson generator intent
      try {
        const intentType = response?.metadata?.user_intent?.primary_intent || '';
        const shouldOpen = intentType === 'create_lesson' || wantsLessonGenerator(userText, response?.content);
        if (shouldOpen) {
          Alert.alert(
            'Open Lesson Generator?',
            'I can open the AI Lesson Generator with the details we discussed.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open', onPress: () => dashInstance.openLessonGeneratorFromContext(userText, response?.content || '') }
            ]
          );
        }
      } catch {}

      // Auto-speak if enabled
      speakResponse(response);

    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
      setLoadingStatus(null);
    }
  }, [dashInstance, conversation, scrollToBottom, updateAttachmentProgress, setLayout, wantsLessonGenerator]);

  // Process queue
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || requestQueueRef.current.length === 0) return;
    
    isProcessingRef.current = true;
    const request = requestQueueRef.current.shift();
    
    if (request) {
      await sendMessageInternal(request.text, request.attachments);
    }
    
    isProcessingRef.current = false;
    
    if (requestQueueRef.current.length > 0) {
      setTimeout(() => processQueue(), 0);
    }
  }, [sendMessageInternal]);

  // Public send message
  const sendMessage = useCallback(async (text: string = inputText.trim()) => {
    if ((!text && selectedAttachments.length === 0) || !dashInstance) return;
    
    if (user?.id) {
      try {
        const quotaCheck = await checkAIQuota(DASH_AI_SERVICE_TYPE, user.id, 1);
        
        if (!quotaCheck.allowed) {
          track('edudash.ai.quota.blocked', {
            service_type: DASH_AI_SERVICE_TYPE,
            quota_used: quotaCheck.quotaInfo?.used,
            quota_limit: quotaCheck.quotaInfo?.limit,
            user_tier: tier || 'free',
            upgrade_shown: true,
          });
          
          showQuotaExceededAlert(DASH_AI_SERVICE_TYPE, quotaCheck.quotaInfo, {
            customMessages: {
              title: 'AI Chat Limit Reached',
              message: 'You\'ve used all your AI chat messages for this month.',
            },
          });
          return;
        }
      } catch (quotaError) {
        console.warn('[useDashAssistant] Quota check failed:', quotaError);
      }
    }
    
    requestQueueRef.current.push({
      text,
      attachments: [...selectedAttachments],
    });

    setInputText('');
    setSelectedAttachments([]);
    processQueue();
  }, [inputText, selectedAttachments, dashInstance, user?.id, tier, processQueue]);

  // Speech functions
  const speakResponse = useCallback(async (message: DashMessage) => {
    if (!dashInstance || message.type !== 'assistant') return;

    // Check tier for TTS access
    if (!hasTTSAccess()) {
      Alert.alert(
        'Voice Playback - Premium',
        'Text-to-speech is a premium feature available on Starter and Plus plans.\n\nUpgrade to unlock:\n• Dash reads responses aloud\n• Voice input\n• Voice commands',
        [
          { text: 'Maybe Later', style: 'cancel' },
          { 
            text: 'Upgrade Now', 
            onPress: () => router.push('/screens/subscription-setup' as any)
          }
        ]
      );
      return;
    }

    if (speakingMessageId === message.id) {
      await stopSpeaking();
      return;
    }

    if (isSpeaking && speakingMessageId) {
      await stopSpeaking();
    }

    try {
      setIsSpeaking(true);
      setSpeakingMessageId(message.id);
      
      await dashInstance.speakResponse(message, {
        onStart: () => {},
        onDone: () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
        },
        onStopped: () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
        },
        onError: (error: any) => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
          
          // Check for tier-blocked error
          if (error?.message === 'TTS_FREE_TIER_BLOCKED') {
            Alert.alert(
              'Voice Playback - Premium',
              'Text-to-speech is a premium feature. Upgrade to Starter or Plus to unlock voice features.',
              [
                { text: 'Maybe Later', style: 'cancel' },
                { 
                  text: 'Upgrade Now', 
                  onPress: () => router.push('/screens/subscription-setup' as any)
                }
              ]
            );
          }
        }
      });
    } catch (error) {
      console.error('Failed to speak response:', error);
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    }
  }, [dashInstance, speakingMessageId, isSpeaking, hasTTSAccess]);

  const stopSpeaking = useCallback(async () => {
    if (!dashInstance) return;
    
    try {
      await dashInstance.stopSpeaking();
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    } catch (error) {
      console.error('Failed to stop speaking:', error);
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    }
  }, [dashInstance]);

  // Attachment handlers
  const handleAttachFile = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert(
        'Attach Files',
        'Choose the type of files to attach',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Documents', onPress: () => handlePickDocuments() },
          { text: 'Photos', onPress: () => handlePickImages() }
        ]
      );
    } catch (error) {
      console.error('Failed to show file picker:', error);
    }
  }, []);

  const handlePickDocuments = useCallback(async () => {
    try {
      const documents = await pickDocuments();
      if (documents.length > 0) {
        setSelectedAttachments(prev => [...prev, ...documents]);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Failed to pick documents:', error);
      Alert.alert('Error', 'Failed to select documents.');
    }
  }, []);

  const handlePickImages = useCallback(async () => {
    try {
      const images = await pickImages();
      if (images.length > 0) {
        setSelectedAttachments(prev => [...prev, ...images]);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Failed to pick images:', error);
      Alert.alert('Error', 'Failed to select images.');
    }
  }, []);

  const handleTakePhoto = useCallback(async () => {
    try {
      const photos = await takePhoto();
      if (photos.length > 0) {
        setSelectedAttachments(prev => [...prev, ...photos]);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Failed to take photo:', error);
      Alert.alert('Error', 'Failed to take photo.');
    }
  }, []);

  const handleRemoveAttachment = useCallback(async (attachmentId: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedAttachments(prev => prev.filter(att => att.id !== attachmentId));
    } catch (error) {
      console.error('Failed to remove attachment:', error);
    }
  }, []);

  // Check if user has TTS/voice features
  // Note: 'trial' users DO have TTS access (aligned with Edge Function tier list)
  const hasTTSAccess = useCallback(() => {
    const freeTiers = ['free', ''];
    const currentTier = tier?.toLowerCase().replace(/-/g, '_') || 'free';
    return !freeTiers.includes(currentTier);
  }, [tier]);

  // Stop voice recording
  const stopVoiceRecording = useCallback(async () => {
    try {
      if (voiceSessionRef.current && voiceSessionRef.current.isActive()) {
        await voiceSessionRef.current.stop();
      }
      setIsRecording(false);
      setPartialTranscript('');
    } catch (error) {
      console.error('[useDashAssistant] Error stopping voice:', error);
      setIsRecording(false);
      setPartialTranscript('');
    }
  }, []);

  // Handle voice input mic press - START/STOP toggle
  const handleInputMicPress = useCallback(async () => {
    // Check tier for voice features
    if (!hasTTSAccess()) {
      Alert.alert(
        'Voice Features - Premium',
        'Voice input and text-to-speech are premium features available on Starter and Plus plans.\n\nUpgrade to unlock:\n• Voice input (speak to Dash)\n• Text-to-speech (Dash reads responses)\n• Voice commands',
        [
          { text: 'Maybe Later', style: 'cancel' },
          { 
            text: 'Upgrade Now', 
            onPress: () => router.push('/screens/subscription-setup' as any)
          }
        ]
      );
      return;
    }

    // If already recording, stop and send
    if (isRecording) {
      await stopVoiceRecording();
      // The final transcript should already be in inputText from onFinal callback
      return;
    }

    // Start voice recognition
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Request microphone permission first (especially important on Android)
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            {
              title: 'Microphone Permission',
              message: 'Dash AI needs access to your microphone for voice input.',
              buttonPositive: 'Allow',
              buttonNegative: 'Deny',
            }
          );
          
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert(
              'Microphone Permission Required',
              'Please grant microphone permission to use voice input with Dash.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() }
              ]
            );
            return;
          }
        } catch (permErr) {
          console.error('[useDashAssistant] Permission request error:', permErr);
        }
      } else if (Platform.OS === 'ios') {
        // Use expo-audio for iOS permission
        try {
          const { status } = await AudioModule.requestPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              'Microphone Permission Required',
              'Please grant microphone permission to use voice input with Dash.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() }
              ]
            );
            return;
          }
        } catch (permErr) {
          console.error('[useDashAssistant] iOS permission request error:', permErr);
        }
      }
      
      // Get voice provider
      if (!voiceProviderRef.current) {
        voiceProviderRef.current = await getSingleUseVoiceProvider('en-ZA');
      }
      
      const provider = voiceProviderRef.current;
      const available = await provider.isAvailable();
      
      if (!available) {
        Alert.alert(
          'Voice Unavailable',
          Platform.OS === 'android' 
            ? 'Speech recognition is not available on this device.\n\nPossible solutions:\n• Ensure Google app is installed and up-to-date\n• Check device settings for Speech Recognition\n• Some devices may not support on-device speech recognition\n• Try using text input instead'
            : 'Speech recognition is not available on this device. Please check your device settings and microphone permissions.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Create and start session
      const session = provider.createSession();
      voiceSessionRef.current = session;
      
      const started = await session.start({
        language: 'en-ZA',
        onPartial: (text: string) => {
          // Show partial transcript as user speaks
          setPartialTranscript(text);
          // Update input text with partial results
          setInputText(text);
        },
        onFinal: (text: string) => {
          // Final transcript - update input text
          setInputText(text);
          setPartialTranscript('');
          setIsRecording(false);
          
          // Haptic feedback for completion
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          
          // Track voice input usage
          track('edudash.voice.input_completed', {
            transcript_length: text.length,
            user_tier: tier || 'free',
          });
        },
      });

      if (started) {
        setIsRecording(true);
        setPartialTranscript('');
        
        // Track voice input start
        track('edudash.voice.input_started', {
          user_tier: tier || 'free',
        });
      } else {
        Alert.alert(
          'Voice Error',
          'Failed to start voice recognition. Please check microphone permissions and try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[useDashAssistant] Voice recognition error:', error);
      setIsRecording(false);
      setPartialTranscript('');
      
      Alert.alert(
        'Voice Error',
        'An error occurred with voice recognition. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [hasTTSAccess, isRecording, stopVoiceRecording, tier]);

  // Cleanup voice session on unmount
  useEffect(() => {
    return () => {
      if (voiceSessionRef.current && voiceSessionRef.current.isActive()) {
        voiceSessionRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startNewConversation = useCallback(async () => {
    if (!dashInstance) return;
    
    try {
      const newConvId = await dashInstance.startNewConversation('Chat with Dash');
      const newConv = await dashInstance.getConversation(newConvId);
      if (newConv) {
        setConversation(newConv);
        setMessages([]);
        
        const greeting: DashMessage = {
          id: `greeting_${Date.now()}`,
          type: 'assistant',
          content: dashInstance.getPersonality().greeting,
          timestamp: Date.now(),
        };
        setMessages([greeting]);
      }
    } catch (error) {
      console.error('Failed to start new conversation:', error);
      Alert.alert('Error', 'Failed to start new conversation.');
    }
  }, [dashInstance]);

  // Initialize Dash AI
  useEffect(() => {
    const initializeDash = async () => {
      try {
        const module = await import('@/services/dash-ai/DashAICompat');
        const DashClass = (module as any).DashAIAssistant || (module as any).default;
        const dash: IDashAIAssistant | null = DashClass?.getInstance?.() || null;
        if (!dash) throw new Error('DashAIAssistant unavailable');
        await dash.initialize();
        setDashInstance(dash);
        setIsInitialized(true);

        let hasExistingMessages = false;

        if (conversationId) {
          const existingConv = await dash.getConversation(conversationId);
          if (existingConv) {
            hasExistingMessages = (existingConv.messages?.length || 0) > 0;
            setConversation(existingConv);
            setMessages(existingConv.messages || []);
            dash.setCurrentConversationId(conversationId);
          }
        } else {
          const savedConvId = await AsyncStorage.getItem('@dash_ai_current_conversation_id');
          let newConvId = savedConvId || null;
          
          if (newConvId) {
            const existingConv = await dash.getConversation(newConvId);
            if (existingConv) {
              hasExistingMessages = (existingConv.messages?.length || 0) > 0;
              setConversation(existingConv);
              setMessages(existingConv.messages || []);
              dash.setCurrentConversationId(newConvId);
            } else {
              newConvId = null;
            }
          }
          
          if (!newConvId) {
            try {
              const convs = await dash.getAllConversations();
              if (Array.isArray(convs) && convs.length > 0) {
                const latest = convs.reduce((a: any, b: any) => (a.updated_at > b.updated_at ? a : b));
                hasExistingMessages = (latest.messages?.length || 0) > 0;
                setConversation(latest);
                setMessages(latest.messages || []);
                dash.setCurrentConversationId(latest.id);
              } else {
                const createdId = await dash.startNewConversation('Chat with Dash');
                const newConv = await dash.getConversation(createdId);
                if (newConv) setConversation(newConv);
              }
            } catch {
              const createdId = await dash.startNewConversation('Chat with Dash');
              const newConv = await dash.getConversation(createdId);
              if (newConv) setConversation(newConv);
            }
          }
        }

        // Load enterToSend setting
        try {
          const enterToSendSetting = await AsyncStorage.getItem('@dash_ai_enter_to_send');
          if (enterToSendSetting !== null) {
            setEnterToSend(enterToSendSetting === 'true');
          }
        } catch {}

        // Send initial message or add greeting
        if (initialMessage && initialMessage.trim()) {
          sendMessage(initialMessage);
        } else if (!hasExistingMessages) {
          const greeting: DashMessage = {
            id: `greeting_${Date.now()}`,
            type: 'assistant',
            content: dash.getPersonality().greeting,
            timestamp: Date.now(),
          };
          setMessages([greeting]);
        }
      } catch (error) {
        console.error('Failed to initialize Dash:', error);
        Alert.alert('Error', 'Failed to initialize AI Assistant.');
      }
    };

    initializeDash();
  }, [conversationId, initialMessage]);

  // Auto-scroll effects
  useEffect(() => {
    if (isInitialized && messages.length > 0 && flashListRef.current) {
      scrollToBottom({ animated: false, delay: 300 });
    }
  }, [isInitialized]);

  useEffect(() => {
    if (isLoading && flashListRef.current) {
      scrollToBottom({ animated: true, delay: 150 });
    }
  }, [isLoading, loadingStatus, scrollToBottom]);

  // Unread count tracking
  useEffect(() => {
    if (!isInitialized) return;
    const prevLen = prevLengthRef.current || 0;
    const currLen = messages.length;
    if (currLen > prevLen) {
      if (isNearBottom) {
        setUnreadCount(0);
      } else {
        setUnreadCount((c) => Math.min(999, c + (currLen - prevLen)));
      }
    }
    prevLengthRef.current = currLen;
  }, [messages.length, isNearBottom, isInitialized]);

  // Focus effect for conversation refresh
  useFocusEffect(
    useCallback(() => {
      if (dashInstance && conversation) {
        dashInstance.getConversation(conversation.id).then((updatedConv: any) => {
          if (updatedConv && updatedConv.messages.length !== messages.length) {
            setMessages(updatedConv.messages);
            setConversation(updatedConv);
          }
        });
      }

      return () => {
        if (dashInstance && isSpeaking) {
          setIsSpeaking(false);
          dashInstance.stopSpeaking().catch(() => {});
        }
      };
    }, [dashInstance, conversation, messages.length, isSpeaking])
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (dashInstance) {
        dashInstance.stopSpeaking().catch(() => {});
        dashInstance.cleanup();
      }
    };
  }, [dashInstance]);

  // Web beforeunload handler
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (dashInstance && isSpeaking) {
        dashInstance.stopSpeaking().catch(() => {});
      }
    };

    if (
      Platform.OS === 'web' && 
      typeof window !== 'undefined' && 
      typeof window.addEventListener === 'function'
    ) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
    return undefined;
  }, [dashInstance, isSpeaking]);

  return {
    // State
    messages,
    inputText,
    setInputText,
    isLoading,
    loadingStatus,
    streamingMessageId,
    streamingContent,
    isSpeaking,
    speakingMessageId,
    conversation,
    dashInstance,
    isInitialized,
    enterToSend,
    setEnterToSend,
    selectedAttachments,
    isUploading,
    isNearBottom,
    setIsNearBottom,
    unreadCount,
    setUnreadCount,
    
    // Voice input state
    isRecording,
    partialTranscript,
    
    // Refs
    flashListRef,
    inputRef,
    
    // Actions
    sendMessage,
    speakResponse,
    stopSpeaking,
    scrollToBottom,
    handleAttachFile,
    handlePickDocuments,
    handlePickImages,
    handleTakePhoto,
    handleRemoveAttachment,
    handleInputMicPress,
    stopVoiceRecording,
    startNewConversation,
    
    // Helpers
    extractFollowUps,
    wantsLessonGenerator,
    
    // Subscription
    tier,
    subReady,
    refreshTier,
  };
}
