import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';

interface FinancePasswordPromptProps {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export function FinancePasswordPrompt({
  visible,
  onSuccess,
  onCancel,
}: FinancePasswordPromptProps) {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPassword('');
    setSubmitting(false);
    setError(null);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleVerify = async () => {
    if (!password.trim()) {
      setError('Enter your app password to continue.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);

      const supabase = assertSupabase();
      const authUser = (await supabase.auth.getUser()).data.user;
      const email = authUser?.email || profile?.email || user?.email;

      if (!email) {
        setError('No account email found for password verification.');
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: password.trim(),
      });

      if (signInError) {
        setError('Incorrect password. Please try again.');
        return;
      }

      reset();
      onSuccess();
    } catch {
      setError('Could not verify password right now. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed" size={20} color={theme.primary} />
          </View>
          <Text style={styles.title}>Fees are locked</Text>
          <Text style={styles.subtitle}>
            Enter your app password to open fee and payment screens.
          </Text>

          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="App password"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={submitting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleVerify} disabled={submitting}>
              <Text style={styles.confirmText}>{submitting ? 'Checking...' : 'Unlock'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(5,8,20,0.72)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 16,
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary + '20',
      marginBottom: 8,
    },
    title: {
      color: theme.text,
      fontSize: 19,
      fontWeight: '800',
    },
    subtitle: {
      marginTop: 4,
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 12,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      backgroundColor: theme.background,
      color: theme.text,
      fontSize: 15,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    error: {
      marginTop: 8,
      color: theme.error || '#ef4444',
      fontSize: 12,
      fontWeight: '600',
    },
    actions: {
      marginTop: 14,
      flexDirection: 'row',
      gap: 10,
    },
    cancelBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      minHeight: 42,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
    cancelText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    confirmBtn: {
      flex: 1,
      borderRadius: 10,
      minHeight: 42,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
    },
    confirmText: {
      color: theme.onPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
  });

export default FinancePasswordPrompt;

