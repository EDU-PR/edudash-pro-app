/**
 * CosmicOrb - Stunning Cosmic Nebula Animation
 * 
 * Inspired by the reference image with:
 * - Concentric ripple rings
 * - Particle starfield
 * - Aurora light bands
 * - Smooth pulsing glow
 * - Dynamic colors (purple, teal, gold)
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop, G } from 'react-native-svg';

interface CosmicOrbProps {
  size: number;
  isProcessing: boolean;
  isSpeaking: boolean;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const CosmicOrb: React.FC<CosmicOrbProps> = ({ size, isProcessing, isSpeaking }) => {
  // Animations
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring2Scale = useRef(new Animated.Value(1)).current;
  const ring3Scale = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0.8)).current;
  const ring2Opacity = useRef(new Animated.Value(0.6)).current;
  const ring3Opacity = useRef(new Animated.Value(0.4)).current;
  const coreGlow = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const sparkleOpacity = useRef(new Animated.Value(0)).current;

  // Create ripple effect
  useEffect(() => {
    const createRipple = (scaleAnim: Animated.Value, opacityAnim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scaleAnim, {
              toValue: 1.4,
              duration: 3000,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: 3000,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.8,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const ripple1 = createRipple(ring1Scale, ring1Opacity, 0);
    const ripple2 = createRipple(ring2Scale, ring2Opacity, 1000);
    const ripple3 = createRipple(ring3Scale, ring3Opacity, 2000);

    ripple1.start();
    ripple2.start();
    ripple3.start();

    return () => {
      ripple1.stop();
      ripple2.stop();
      ripple3.stop();
    };
  }, []);

  // Core glow pulse
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(coreGlow, {
          toValue: 1.2,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(coreGlow, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Rotation when processing
  useEffect(() => {
    if (isProcessing || isSpeaking) {
      const rotate = Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      rotate.start();
      return () => rotate.stop();
    } else {
      rotation.setValue(0);
    }
  }, [isProcessing, isSpeaking]);

  // Sparkle animation
  useEffect(() => {
    const sparkle = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleOpacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    sparkle.start();
    return () => sparkle.stop();
  }, []);

  const rotateInterpolate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const radius = size / 2;
  const centerX = size / 2;
  const centerY = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      {/* Background starfield */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}>
        {[...Array(20)].map((_, i) => (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: 2,
              height: 2,
              borderRadius: 1,
              backgroundColor: i % 3 === 0 ? '#fbbf24' : '#a78bfa',
              left: `${(i * 17) % 100}%`,
              top: `${(i * 13) % 100}%`,
              opacity: sparkleOpacity,
            }}
          />
        ))}
      </View>

      {/* Ripple rings */}
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id="ring1" cx="50%" cy="50%">
            <Stop offset="0%" stopColor="#8b5cf6" stopOpacity="0" />
            <Stop offset="70%" stopColor="#8b5cf6" stopOpacity="0.6" />
            <Stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="ring2" cx="50%" cy="50%">
            <Stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
            <Stop offset="70%" stopColor="#06b6d4" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="ring3" cx="50%" cy="50%">
            <Stop offset="0%" stopColor="#fbbf24" stopOpacity="0" />
            <Stop offset="70%" stopColor="#fbbf24" stopOpacity="0.3" />
            <Stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Animated Ripple Rings */}
        <AnimatedCircle
          cx={centerX}
          cy={centerY}
          r={radius * 0.7}
          fill="url(#ring1)"
          opacity={ring1Opacity}
          scale={ring1Scale}
          origin={`${centerX}, ${centerY}`}
        />
        <AnimatedCircle
          cx={centerX}
          cy={centerY}
          r={radius * 0.7}
          fill="url(#ring2)"
          opacity={ring2Opacity}
          scale={ring2Scale}
          origin={`${centerX}, ${centerY}`}
        />
        <AnimatedCircle
          cx={centerX}
          cy={centerY}
          r={radius * 0.7}
          fill="url(#ring3)"
          opacity={ring3Opacity}
          scale={ring3Scale}
          origin={`${centerX}, ${centerY}`}
        />
      </Svg>

      {/* Rotating aurora bands */}
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          transform: [{ rotate: rotateInterpolate }],
        }}
      >
        <LinearGradient
          colors={['#8b5cf6', 'transparent', '#06b6d4', 'transparent', '#fbbf24', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            opacity: 0.3,
          }}
        />
      </Animated.View>

      {/* Core orb with glow */}
      <Animated.View
        style={{
          position: 'absolute',
          width: radius,
          height: radius,
          top: radius / 2,
          left: radius / 2,
          borderRadius: radius / 2,
          transform: [{ scale: coreGlow }],
        }}
      >
        <LinearGradient
          colors={['#a78bfa', '#8b5cf6', '#6366f1', '#4f46e5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: radius,
            height: radius,
            borderRadius: radius / 2,
            shadowColor: '#8b5cf6',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 20,
            elevation: 10,
          }}
        />
      </Animated.View>

      {/* Inner core highlight */}
      <View
        style={{
          position: 'absolute',
          width: radius * 0.4,
          height: radius * 0.4,
          top: radius * 0.8,
          left: radius * 0.8,
          borderRadius: (radius * 0.4) / 2,
          backgroundColor: '#fff',
          opacity: 0.4,
        }}
      />
    </View>
  );
};
