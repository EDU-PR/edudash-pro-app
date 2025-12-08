/**
 * Animated Splash Screen Component
 * 
 * Beautiful animated splash screen with logo animations,
 * gradient background, letter-by-letter text reveal, and smooth transitions
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

const { width, height } = Dimensions.get('window');

// Keep native splash visible until we're ready
SplashScreen.preventAutoHideAsync();

// Brand text to animate letter by letter
const BRAND_TEXT = 'EduDash Pro';

interface AnimatedSplashProps {
  onFinish?: () => void;
}

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  // Animation values
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  
  const ring1Scale = useRef(new Animated.Value(0.8)).current;
  const ring1Opacity = useRef(new Animated.Value(0)).current;
  
  const ring2Scale = useRef(new Animated.Value(0.8)).current;
  const ring2Opacity = useRef(new Animated.Value(0)).current;
  
  const ring3Scale = useRef(new Animated.Value(0.8)).current;
  const ring3Opacity = useRef(new Animated.Value(0)).current;
  
  const sparkleOpacity = useRef(new Animated.Value(0)).current;
  const sparkleRotate = useRef(new Animated.Value(0)).current;
  
  // Letter animation values - one for each letter
  const letterAnimations = useRef(
    BRAND_TEXT.split('').map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(-30),
      scale: new Animated.Value(0.5),
    }))
  ).current;
  
  // Text container position - starts near logo, moves to bottom
  const textContainerY = useRef(new Animated.Value(0)).current;
  
  // Tagline animation
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Hide native splash immediately when component mounts
    SplashScreen.hideAsync();

    // Create letter animations - staggered appearance
    const letterAppearAnimations = letterAnimations.map((anim, index) => 
      Animated.parallel([
        Animated.timing(anim.opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(anim.translateY, {
          toValue: 0,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(anim.scale, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ])
    );

    // Sequence of animations
    Animated.sequence([
      // 1. Logo appears with scale and fade
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      
      // 2. Rings expand outward + letters start appearing
      Animated.parallel([
        // Rings animation
        Animated.stagger(150, [
          Animated.parallel([
            Animated.spring(ring1Scale, {
              toValue: 1.3,
              tension: 40,
              friction: 8,
              useNativeDriver: true,
            }),
            Animated.timing(ring1Opacity, {
              toValue: 0.6,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.spring(ring2Scale, {
              toValue: 1.5,
              tension: 40,
              friction: 8,
              useNativeDriver: true,
            }),
            Animated.timing(ring2Opacity, {
              toValue: 0.4,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.spring(ring3Scale, {
              toValue: 1.7,
              tension: 40,
              friction: 8,
              useNativeDriver: true,
            }),
            Animated.timing(ring3Opacity, {
              toValue: 0.2,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
        ]),
        // Letters appear one by one during ring expansion
        Animated.stagger(60, letterAppearAnimations),
      ]),
      
      // 3. Sparkle effect + text moves to bottom
      Animated.parallel([
        Animated.timing(sparkleOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleRotate, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        // Move text container to bottom
        Animated.spring(textContainerY, {
          toValue: 1,
          tension: 40,
          friction: 10,
          useNativeDriver: true,
        }),
      ]),
      
      // 4. Tagline fades in
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      
      // 5. Small delay before finishing
      Animated.delay(400),
    ]).start(() => {
      // Animation complete, notify parent
      if (onFinish) {
        onFinish();
      }
    });

    // Continuous subtle rotation for logo
    Animated.loop(
      Animated.timing(logoRotate, {
        toValue: 1,
        duration: 20000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const logoRotateInterpolate = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const sparkleRotateInterpolate = sparkleRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Text container moves from near logo to bottom
  const textContainerTranslateY = textContainerY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, height * 0.3], // Move down 30% of screen
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a0a0f', '#1a0a2e', '#2d1b4e', '#1a0a2e', '#0a0a0f']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Animated rings */}
        <Animated.View
          style={[
            styles.ring,
            {
              transform: [{ scale: ring3Scale }],
              opacity: ring3Opacity,
              width: 280,
              height: 280,
              borderRadius: 140,
              borderWidth: 2,
              borderColor: '#7c3aed',
            },
          ]}
        />
        <Animated.View
          style={[
            styles.ring,
            {
              transform: [{ scale: ring2Scale }],
              opacity: ring2Opacity,
              width: 240,
              height: 240,
              borderRadius: 120,
              borderWidth: 3,
              borderColor: '#a855f7',
            },
          ]}
        />
        <Animated.View
          style={[
            styles.ring,
            {
              transform: [{ scale: ring1Scale }],
              opacity: ring1Opacity,
              width: 200,
              height: 200,
              borderRadius: 100,
              borderWidth: 4,
              borderColor: '#c084fc',
            },
          ]}
        />

        {/* Main logo container */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [
                { scale: logoScale },
                { rotate: logoRotateInterpolate },
              ],
              opacity: logoOpacity,
            },
          ]}
        >
          <LinearGradient
            colors={['#1E293B', '#334155', '#1E293B']}
            style={styles.logoGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Image
              source={require('@/assets/icon.png')}
              style={{ width: 80, height: 80 }}
              resizeMode="contain"
            />
          </LinearGradient>
        </Animated.View>

        {/* Sparkle effect */}
        <Animated.View
          style={[
            styles.sparkleContainer,
            {
              opacity: sparkleOpacity,
              transform: [{ rotate: sparkleRotateInterpolate }],
            },
          ]}
        >
          <Ionicons name="sparkles" size={40} color="#fbbf24" />
        </Animated.View>
        
        {/* Animated EduDash Pro text - letter by letter */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              transform: [{ translateY: textContainerTranslateY }],
            },
          ]}
        >
          <View style={styles.letterRow}>
            {BRAND_TEXT.split('').map((letter, index) => (
              <Animated.Text
                key={index}
                style={[
                  styles.brandLetter,
                  {
                    opacity: letterAnimations[index].opacity,
                    transform: [
                      { translateY: letterAnimations[index].translateY },
                      { scale: letterAnimations[index].scale },
                    ],
                  },
                ]}
              >
                {letter === ' ' ? '\u00A0' : letter}
              </Animated.Text>
            ))}
          </View>
          <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
            Empowering Education
          </Animated.Text>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width,
    height,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
  },
  logoContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  logoGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkleContainer: {
    position: 'absolute',
    top: height / 2 - 140,
    right: width / 2 - 100,
  },
  textContainer: {
    position: 'absolute',
    bottom: height / 2 - 120,
    alignItems: 'center',
  },
  letterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLetter: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    textShadowColor: 'rgba(124, 58, 237, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
    letterSpacing: 2,
  },
});
