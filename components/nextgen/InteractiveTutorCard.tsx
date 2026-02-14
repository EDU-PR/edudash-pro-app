import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ROBOT_MASCOT = require('@/assets/images/robot-mascot.png');

export default function InteractiveTutorCard({ onPress }: { onPress?: () => void }) {
  return (
    <LinearGradient
      colors={['#22433F', '#3C8E62', '#5A409D']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Robot mascot */}
        <Image source={ROBOT_MASCOT} style={styles.robotImage} />

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
  robotImage: {
    width: 72,
    height: 72,
    borderRadius: 18,
    resizeMode: 'contain',
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
