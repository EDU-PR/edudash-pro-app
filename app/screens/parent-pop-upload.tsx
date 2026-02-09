import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

export default function ParentPoPUploadLegacyRedirect() {
  const { theme } = useTheme();
  const { ref, amount } = useLocalSearchParams<{ ref?: string; amount?: string }>();

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace({
        pathname: '/screens/parent-payments',
        params: {
          tab: 'upload',
          ref: ref ? String(ref) : '',
          amount: amount ? String(amount) : '',
          purpose: 'Registration Fee',
        },
      } as any);
    }, 250);

    return () => clearTimeout(timeout);
  }, [ref, amount]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 14,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
    },
    text: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    button: {
      marginTop: 6,
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    buttonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
    },
  });

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: 'Upload PoP',
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
          headerTintColor: theme.primary,
        }}
      />
      <SafeAreaView style={styles.container}>
        <Ionicons name="swap-horizontal" size={44} color={theme.primary} />
        <Text style={styles.title}>Redirecting to Payments</Text>
        <Text style={styles.text}>
          This upload link has moved. We are opening the new Payments screen so you can upload safely.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() =>
            router.replace({
              pathname: '/screens/parent-payments',
              params: {
                tab: 'upload',
                ref: ref ? String(ref) : '',
                amount: amount ? String(amount) : '',
                purpose: 'Registration Fee',
              },
            } as any)
          }
        >
          <Ionicons name="arrow-forward" size={16} color="#fff" />
          <Text style={styles.buttonText}>Open Payments</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}
