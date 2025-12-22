/**
 * VoiceMessageBubble Component - Enhanced
 * WhatsApp-style voice message player with animated waveform
 * Uses expo-av Audio.Sound API for stable playback
 * 
 * Features:
 * - Play/pause button with gradient
 * - Animated waveform visualization that moves during playback
 * - Duration and progress display
 * - Profile picture for received messages
 * - Seek by tapping on waveform
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { PURPLE_LIGHT, SUCCESS_GREEN } from './theme';

// Generate random waveform bars (normalized 0-1)
const generateWaveformBars = (count: number = 25): number[] => {
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    // Create a somewhat natural looking waveform
    const base = 0.3 + Math.random() * 0.4;
    const variation = Math.sin(i * 0.3) * 0.2;
    bars.push(Math.min(1, Math.max(0.15, base + variation)));
  }
  return bars;
};

interface VoiceMessageBubbleProps {
  audioUrl: string;
  duration: number; // in milliseconds
  isOwnMessage: boolean;
  timestamp: string;
  senderAvatar?: string;
  senderName?: string;
  isRead?: boolean;
  onLongPress?: () => void;
}

export const VoiceMessageBubble: React.FC<VoiceMessageBubbleProps> = ({
  audioUrl,
  duration,
  isOwnMessage,
  timestamp,
  senderAvatar,
  senderName,
  isRead = false,
  onLongPress,
}) => {
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  
  const waveformBars = useRef(generateWaveformBars(25)).current;
  const soundRef = useRef<Audio.Sound | null>(null);
  const audioDurationRef = useRef<number>(duration);
  
  // Animated values for each bar
  const barAnimations = useRef(
    waveformBars.map(() => new Animated.Value(0))
  ).current;

  // Format duration as MM:SS
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  // Animate bars when playing
  useEffect(() => {
    if (isPlaying) {
      const animations = barAnimations.map((anim, index) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 200 + Math.random() * 300,
              useNativeDriver: false, // height animation requires JS driver
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 200 + Math.random() * 300,
              useNativeDriver: false,
            }),
          ])
        );
      });
      
      Animated.stagger(20, animations).start();
      
      return () => {
        barAnimations.forEach(anim => anim.stopAnimation());
      };
    } else {
      barAnimations.forEach(anim => anim.setValue(0));
    }
  }, [isPlaying, barAnimations]);

  // Audio status callback
  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setCurrentPosition(status.positionMillis || 0);
      if (status.durationMillis) {
        audioDurationRef.current = status.durationMillis;
        setPlaybackProgress(status.positionMillis / status.durationMillis);
      }
      setIsPlaying(status.isPlaying);
      
      if (status.didJustFinish) {
        setIsPlaying(false);
        setCurrentPosition(0);
        setPlaybackProgress(0);
      }
    }
  };

  const handlePlayPause = async () => {
    try {
      setIsLoading(true);
      
      if (isPlaying && soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        // Create sound if not exists
        if (!soundRef.current) {
          const { sound } = await Audio.Sound.createAsync(
            { uri: audioUrl },
            { shouldPlay: true },
            onPlaybackStatusUpdate
          );
          soundRef.current = sound;
        } else {
          // Check if finished, restart from beginning
          const status = await soundRef.current.getStatusAsync();
          if (status.isLoaded && status.positionMillis >= (status.durationMillis || 0) - 100) {
            await soundRef.current.setPositionAsync(0);
          }
          await soundRef.current.playAsync();
        }
        setIsPlaying(true);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('[VoiceMessageBubble] Error playing audio:', error);
      setIsLoading(false);
    }
  };

  // Handle seeking by tapping on waveform
  const handleSeek = async (index: number) => {
    if (!soundRef.current) return;
    
    try {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded && status.durationMillis) {
        const seekPosition = (index / waveformBars.length) * status.durationMillis;
        await soundRef.current.setPositionAsync(seekPosition);
        setCurrentPosition(seekPosition);
        setPlaybackProgress(index / waveformBars.length);
      }
    } catch (error) {
      console.error('[VoiceMessageBubble] Error seeking:', error);
    }
  };

  const displayTime = isPlaying || currentPosition > 0 
    ? formatTime(currentPosition) 
    : formatTime(duration);

  // Teal gradient for own messages, purple for received
  const ownMessageGradient = ['#14b8a6', '#0d9488'] as const;
  const receivedMessageGradient = ['#8b5cf6', '#7c3aed'] as const;

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      maxWidth: '88%',
      alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
      marginVertical: 4,
      marginHorizontal: 12,
    },
    avatarContainer: {
      marginRight: 10,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: theme.primary + '30',
    },
    avatarPlaceholder: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.primary + '30',
    },
    bubble: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isOwnMessage ? '#0d9488' : theme.surface,
      borderRadius: 24,
      paddingVertical: 12,
      paddingHorizontal: 14,
      minWidth: 240,
      maxWidth: '100%',
      // Shadow for depth
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      // Bubble tail effect via border
      borderWidth: isOwnMessage ? 0 : 1,
      borderColor: theme.border + '30',
    },
    playButtonWrapper: {
      marginRight: 12,
    },
    playButtonGradient: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      // Enhanced shadow
      shadowColor: isOwnMessage ? '#14b8a6' : PURPLE_LIGHT,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 5,
    },
    waveformContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      height: 40,
      marginRight: 10,
      paddingVertical: 4,
      overflow: 'hidden',
    },
    waveformBar: {
      width: 3.5,
      marginHorizontal: 1,
      borderRadius: 2,
      backgroundColor: isOwnMessage 
        ? 'rgba(255,255,255,0.4)' 
        : theme.textSecondary + '40',
    },
    waveformBarPlayed: {
      backgroundColor: isOwnMessage 
        ? '#ffffff' 
        : theme.primary,
    },
    infoContainer: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      minWidth: 50,
      paddingLeft: 4,
    },
    duration: {
      fontSize: 13,
      fontWeight: '600',
      color: isOwnMessage ? '#ffffff' : theme.text,
      marginBottom: 3,
    },
    timestampRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    timestamp: {
      fontSize: 11,
      color: isOwnMessage ? 'rgba(255,255,255,0.75)' : theme.textSecondary,
    },
    readReceipt: {
      fontSize: 11,
      color: isRead ? SUCCESS_GREEN : (isOwnMessage ? 'rgba(255,255,255,0.6)' : theme.textSecondary),
      marginLeft: 3,
      fontWeight: '600',
    },
    micBadge: {
      position: 'absolute',
      right: 8,
      top: 8,
      backgroundColor: theme.primary + '20',
      borderRadius: 10,
      padding: 4,
    },
  });

  const playedBars = Math.floor(playbackProgress * waveformBars.length);

  return (
    <View style={styles.container}>
      {/* Avatar for received messages */}
      {!isOwnMessage && (
        <View style={styles.avatarContainer}>
          {senderAvatar ? (
            <Image source={{ uri: senderAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={18} color={theme.primary} />
            </View>
          )}
        </View>
      )}
      
      <Pressable 
        style={styles.bubble}
        onLongPress={onLongPress}
        delayLongPress={300}
      >
        {/* Play/Pause Button with Gradient */}
        <TouchableOpacity 
          onPress={handlePlayPause}
          disabled={isLoading}
          activeOpacity={0.7}
          style={styles.playButtonWrapper}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <LinearGradient
            colors={isOwnMessage ? ownMessageGradient : receivedMessageGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.playButtonGradient}
          >
            {isLoading ? (
              <Ionicons 
                name="hourglass-outline" 
                size={24} 
                color="#fff" 
              />
            ) : (
              <Ionicons 
                name={isPlaying ? 'pause' : 'play'} 
                size={24} 
                color="#fff"
                style={!isPlaying ? { marginLeft: 3 } : undefined}
              />
            )}
          </LinearGradient>
        </TouchableOpacity>
        
        {/* Waveform - Tap to seek */}
        <View style={styles.waveformContainer}>
          {waveformBars.map((height, index) => {
            const isPlayed = index < playedBars;
            const animatedHeight = barAnimations[index].interpolate({
              inputRange: [0, 1],
              outputRange: [height * 24, height * 36],
            });
            
            return (
              <Pressable
                key={index}
                onPress={() => handleSeek(index)}
                style={{ paddingVertical: 6, paddingHorizontal: 0.5 }}
                hitSlop={{ top: 4, bottom: 4 }}
              >
                <Animated.View
                  style={[
                    styles.waveformBar,
                    isPlayed && styles.waveformBarPlayed,
                    {
                      height: isPlaying 
                        ? animatedHeight 
                        : height * 24,
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
        
        {/* Duration and timestamp */}
        <View style={styles.infoContainer}>
          <Text style={styles.duration}>{displayTime}</Text>
          <View style={styles.timestampRow}>
            <Text style={styles.timestamp}>{timestamp}</Text>
            {isOwnMessage && (
              <Text style={styles.readReceipt}>
                {isRead ? '✓✓' : '✓'}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
      
      {/* Spacer for own messages */}
      {isOwnMessage && <View style={{ width: 4 }} />}
    </View>
  );
};

export default VoiceMessageBubble;
