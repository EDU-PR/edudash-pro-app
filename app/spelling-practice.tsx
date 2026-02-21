import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function SpellingPracticeRoute() {
  const { theme } = useTheme();

  useEffect(() => {
    router.replace({
      pathname: '/screens/dash-tutor',
      params: { mode: 'practice' },
    } as any);
  }, []);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.background,
        paddingHorizontal: 24,
      }}
    >
      <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
        Opening spelling practice...
      </Text>
    </View>
  );
}

