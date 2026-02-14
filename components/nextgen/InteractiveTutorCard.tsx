import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function InteractiveTutorCard({ onPress }: { onPress?: () => void }) {
  return (
    <LinearGradient
      colors={['#22433F', '#3C8E62', '#5A409D']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Robot mascot with brain icon */}
        <View style={styles.robotContainer}>
          <LinearGradient
            colors={['rgba(90,64,157,0.35)', 'rgba(60,142,98,0.25)']}
            style={styles.robotBg}
          >
            <MaterialCommunityIcons name="robot-happy" size={28} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.brainBadge}>
            <MaterialCommunityIcons name="brain" size={12} color="#C7BFFF" />
          </View>
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.title}>Interactive Tutor Session</Text>
          <Text style={styles.subtitle}>
            Live step-by-step help. Dash adapts one question at a time.
          </Text>

          <Pressable style={styles.button} onPress={onPress}>
            <Text style={styles.buttonText}>Start Tutor Session →</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 18,
    marginVertical: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  robotContainer: {
    position: 'relative',
  },
  robotBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  brainBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(90,64,157,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#22433F',
  },
  textBlock: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginVertical: 4,
  },
  button: {
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
