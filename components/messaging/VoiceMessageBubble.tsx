/**
 * VoiceMessageBubble Component - Enhanced
 * WhatsApp-style voice message player with animated waveform
 * Features:
 * - Play/pause button with gradient
 * - Animated waveform visualization that moves during playback
 * - Duration and progress display
 * - Profile picture for received messages
 * - Seek by tapping on waveform
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { Audio, AVPlaybackStatus } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';

// Generate random waveform bars (normalized 0-1)
const generateWaveformBars = (count: number = 40): number[] => {
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
}

export const VoiceMessageBubble: React.FC<VoiceMessageBubbleProps> = ({
  audioUrl,
  duration,
  isOwnMessage,
  timestamp,
  senderAvatar,
  senderName,
  isRead = false,
}) => {
  const { theme } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const waveformBars = useRef(generateWaveformBars(35)).current;
  
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

  // Animate bars when playing
  useEffect(() => {
    if (isPlaying) {
      const animations = barAnimations.map((anim, index) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 200 + Math.random() * 300,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 200 + Math.random() * 300,
              useNativeDriver: true,
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPlaybackProgress(0);
      setCurrentPosition(0);
      soundRef.current?.setPositionAsync(0);
    } else if (status.isPlaying && status.durationMillis) {
      const progress = status.positionMillis / status.durationMillis;
      setPlaybackProgress(progress);
      setCurrentPosition(status.positionMillis);
    }
  }, []);

  const handlePlayPause = async () => {
    try {
      if (!soundRef.current) {
        setIsLoading(true);
        
        // Configure audio mode
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
        
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        
        soundRef.current = sound;
        setIsPlaying(true);
        setIsLoading(false);
      } else {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await soundRef.current.pauseAsync();
            setIsPlaying(false);
          } else {
            await soundRef.current.playAsync();
            setIsPlaying(true);
          }
        }
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const displayTime = isPlaying || currentPosition > 0 
    ? formatTime(currentPosition) 
    : formatTime(duration);

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      maxWidth: '85%',
      alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
      marginVertical: 2,
      marginHorizontal: 8,
    },
    avatarContainer: {
      marginRight: 8,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    avatarPlaceholder: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.primary + '30',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bubble: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isOwnMessage ? theme.primary : theme.surface,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 12,
      minWidth: 200,
    },
    playButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.2)' : theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    playButtonGradient: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#7c3aed',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 4,
    },
    waveformContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      height: 32,
      marginRight: 8,
    },
    waveformBar: {
      width: 3,
      marginHorizontal: 1,
      borderRadius: 1.5,
      backgroundColor: isOwnMessage 
        ? 'rgba(255,255,255,0.5)' 
        : theme.textSecondary + '60',
    },
    waveformBarPlayed: {
      backgroundColor: isOwnMessage 
        ? theme.onPrimary 
        : theme.primary,
    },
    infoContainer: {
      alignItems: 'flex-end',
      minWidth: 45,
    },
    duration: {
      fontSize: 11,
      color: isOwnMessage ? theme.onPrimary + '90' : theme.textSecondary,
      marginBottom: 2,
    },
    timestamp: {
      fontSize: 10,
      color: isOwnMessage ? theme.onPrimary + '70' : theme.textSecondary,
    },
    readReceipt: {
      fontSize: 10,
      color: isRead ? '#34d399' : (isOwnMessage ? theme.onPrimary + '70' : theme.textSecondary),
      marginLeft: 2,
    },
    micIcon: {
      position: 'absolute',
      right: -4,
      bottom: -4,
    },
  });

  const playedBars = Math.floor(playbackProgress * waveformBars.length);

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
      console.error('Error seeking:', error);
    }
  };

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
      
      <View style={styles.bubble}>
        {/* Play/Pause Button with Gradient */}
        <TouchableOpacity 
          onPress={handlePlayPause}
          disabled={isLoading}
          activeOpacity={0.8}
          style={{ marginRight: 10 }}
        >
          <LinearGradient
            colors={['#7c3aed', '#ec4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.playButtonGradient}
          >
            {isLoading ? (
              <Ionicons 
                name="hourglass-outline" 
                size={20} 
                color="#fff" 
              />
            ) : (
              <Ionicons 
                name={isPlaying ? 'pause' : 'play'} 
                size={20} 
                color="#fff"
                style={!isPlaying ? { marginLeft: 2 } : undefined}
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
              outputRange: [height * 22, height * 32],
            });
            
            return (
              <Pressable
                key={index}
                onPress={() => handleSeek(index)}
                style={{ paddingVertical: 4 }}
              >
                <Animated.View
                  style={[
                    styles.waveformBar,
                    isPlayed && styles.waveformBarPlayed,
                    {
                      height: isPlaying 
                        ? animatedHeight 
                        : height * 22,
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.timestamp}>{timestamp}</Text>
            {isOwnMessage && (
              <Text style={styles.readReceipt}>
                {isRead ? '✓✓' : '✓'}
              </Text>
            )}
          </View>
        </View>
        
        {/* Mic icon indicator */}
        {!isOwnMessage && (
          <View style={styles.micIcon}>
            <Ionicons name="mic" size={14} color={theme.primary} />
          </View>
        )}
      </View>
      
      {/* Avatar placeholder for own messages to maintain layout */}
      {isOwnMessage && <View style={{ width: 8 }} />}
    </View>
  );
};

export default VoiceMessageBubble;
