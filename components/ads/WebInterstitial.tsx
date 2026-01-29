import React, { useMemo } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface WebInterstitialProps {
  visible: boolean;
  tag: string;
  onClose: () => void;
}

export function WebInterstitial({ visible, tag, onClose }: WebInterstitialProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Sponsored</Text>
          <Text style={styles.subtitle}>
            Thanks for supporting EduDash Pro. This helps keep free features available.
          </Text>
          <Text style={styles.meta}>Placement: {tag}</Text>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 18,
      padding: 20,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowOffset: { width: 0, height: 10 },
      shadowRadius: 30,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 12,
      lineHeight: 18,
    },
    meta: {
      fontSize: 11,
      color: theme.textSecondary,
      marginBottom: 16,
    },
    button: {
      alignSelf: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: theme.primary,
    },
    buttonText: {
      color: theme.onPrimary,
      fontWeight: '700',
    },
  });

export default WebInterstitial;
