import { Stack } from 'expo-router';

export default function LearnerLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0b1220',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen name="programs" />
      <Stack.Screen name="submissions" />
      <Stack.Screen name="connections" />
      <Stack.Screen name="courses" />
      <Stack.Screen name="cv" />
      <Stack.Screen name="portfolio" />
    </Stack>
  );
}


