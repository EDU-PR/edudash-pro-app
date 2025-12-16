/**
 * CourseVideoPlayer
 * 
 * Video player component for online courses with:
 * - Playback controls
 * - Progress tracking
 * - Auto-save progress
 * - Fullscreen support
 * - Speed control
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIDEO_HEIGHT = (SCREEN_WIDTH * 9) / 16; // 16:9 aspect ratio

interface CourseVideoPlayerProps {
  videoUrl: string;
  courseId?: string;
  lessonId?: string;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  autoplay?: boolean;
  startTime?: number; // Resume from saved position
}

export function CourseVideoPlayer({
  videoUrl,
  courseId,
  lessonId,
  onProgress,
  onComplete,
  autoplay = false,
  startTime = 0,
}: CourseVideoPlayerProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(theme);

  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [currentPosition, setCurrentPosition] = useState(startTime);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Auto-hide controls after 3 seconds
    if (isPlaying && showControls) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, showControls]);

  useEffect(() => {
    // Seek to saved position on load
    if (videoRef.current && startTime > 0 && duration > 0) {
      videoRef.current.setPositionAsync(startTime * 1000); // Convert to milliseconds
    }
  }, [startTime, duration]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    setStatus(status);

    if (status.isLoaded) {
      setIsLoading(false);
      setIsPlaying(status.isPlaying);
      setCurrentPosition(status.positionMillis / 1000); // Convert to seconds
      setDuration(status.durationMillis ? status.durationMillis / 1000 : 0);

      // Calculate progress percentage
      if (status.durationMillis && onProgress) {
        const progress = (status.positionMillis / status.durationMillis) * 100;
        onProgress(progress);
      }

      // Check if video completed
      if (status.didJustFinish && onComplete) {
        onComplete();
      }
    } else if (status.error) {
      setIsLoading(false);
      console.error('Video playback error:', status.error);
    }
  };

  const togglePlayPause = async () => {
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
        setShowControls(true);
      }
    }
  };

  const handleSeek = async (position: number) => {
    if (videoRef.current && duration > 0) {
      const seekTime = (position / 100) * duration;
      await videoRef.current.setPositionAsync(seekTime * 1000);
      setShowControls(true);
    }
  };

  const changePlaybackRate = async (rate: number) => {
    if (videoRef.current) {
      await videoRef.current.setRateAsync(rate, true);
      setPlaybackRate(rate);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentPosition / duration) * 100 : 0;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.videoContainer}
        activeOpacity={1}
        onPress={() => setShowControls(!showControls)}
      >
        <Video
          ref={videoRef}
          style={styles.video}
          source={{ uri: videoUrl }}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={autoplay}
          isLooping={false}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          progressUpdateIntervalMillis={1000}
        />

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>
              {t('course.loading_video', { defaultValue: 'Loading video...' })}
            </Text>
          </View>
        )}

        {/* Video Overlay Controls */}
        {showControls && !isLoading && (
          <View style={styles.overlay}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={togglePlayPause}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={48}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom Controls Bar */}
        {showControls && !isLoading && (
          <View style={styles.controlsBar}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={togglePlayPause}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>

            <Text style={styles.timeText}>{formatTime(currentPosition)}</Text>

            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progress}%`, backgroundColor: theme.primary },
                  ]}
                />
              </View>
              <TouchableOpacity
                style={styles.seekButton}
                onPressIn={() => {}}
                onPressOut={(e) => {
                  const { locationX } = e.nativeEvent;
                  const percentage = (locationX / SCREEN_WIDTH) * 100;
                  handleSeek(percentage);
                }}
              />
            </View>

            <Text style={styles.timeText}>{formatTime(duration)}</Text>

            {/* Speed Control */}
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => {
                const rates = [0.75, 1.0, 1.25, 1.5, 2.0];
                const currentIndex = rates.indexOf(playbackRate);
                const nextIndex = (currentIndex + 1) % rates.length;
                changePlaybackRate(rates[nextIndex]);
              }}
            >
              <Text style={styles.speedText}>{playbackRate}x</Text>
            </TouchableOpacity>

            {/* Fullscreen (if supported) */}
            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => setIsFullscreen(!isFullscreen)}
              >
                <Ionicons
                  name={isFullscreen ? 'contract' : 'expand'}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 16,
  },
  videoContainer: {
    width: '100%',
    height: VIDEO_HEIGHT,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    gap: 8,
  },
  controlButton: {
    padding: 4,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 45,
  },
  progressBarContainer: {
    flex: 1,
    height: 20,
    position: 'relative',
    justifyContent: 'center',
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  seekButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  speedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});


