import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { setActiveOrganization } from '@/components/account/OrganizationSwitcher';
import { setPendingTeacherInvite } from '@/lib/utils/teacherInvitePending';
import { useAlertModal, AlertModal } from '@/components/ui/AlertModal';

/** Parse token and email from a pasted invite URL like /invite/teacher?token=X&email=Y */
function parseInviteUrl(pasted: string): { token: string; email: string } | null {
  const s = String(pasted || '').trim();
  if (!s) return null;
  try {
    const url = s.startsWith('http') ? s : `https://dummy.com${s.startsWith('/') ? s : `/${s}`}`;
    const parsed = new URL(url);
    const token = parsed.searchParams.get('token') || '';
    const email = parsed.searchParams.get('email') || '';
    if (token && email) return { token, email };
    return null;
  } catch {
    return null;
  }
}

export default function TeacherInviteAcceptScreen() {
  const { user } = useAuth();
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showAlert, alertProps } = useAlertModal();

  // Prefill from deep link params if present
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  React.useEffect(() => {
    if (typeof params?.token === 'string' && params.token) setToken(String(params.token));
    if (typeof params?.email === 'string' && params.email) setEmail(String(params.email));
  }, [params?.token, params?.email]);

  const handleLinkInputChange = useCallback((text: string) => {
    const parsed = parseInviteUrl(text);
    if (parsed) {
      setToken(parsed.token);
      setEmail(parsed.email);
    }
  }, []);

  const handleSignIn = async () => {
    if (token.trim() && email.trim()) {
      await setPendingTeacherInvite({ token: token.trim(), email: email.trim() });
    }
    router.replace({ pathname: '/(auth)/sign-in' as any, params: { email: email.trim() } } as any);
  };

  const handleSignUp = async () => {
    if (token.trim() && email.trim()) {
      await setPendingTeacherInvite({ token: token.trim(), email: email.trim() });
    }
    router.replace({ pathname: '/(auth)/teacher-signup' as any, params: { email: email.trim() } } as any);
  };

  const onAccept = async () => {
    if (!user?.id) {
      showAlert({
        title: 'Sign in required',
        message: 'Please sign in or create an account to accept this invite.',
        type: 'warning',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: handleSignIn },
          { text: 'Create Account', onPress: handleSignUp },
        ],
      });
      return;
    }
    if (!token.trim() || !email.trim()) {
      showAlert({ title: 'Missing info', message: 'Enter the invite token and email.', type: 'warning' });
      return;
    }
    try {
      setSubmitting(true);
      const { TeacherInviteService } = await import('@/lib/services/teacherInviteService');
      const result = await TeacherInviteService.accept({ token: token.trim(), authUserId: user.id, email: email.trim() });

      if (result.status === 'requires_switch') {
        showAlert({
          title: 'Invite accepted',
          message: 'You are already linked to another school. Switch now to complete principal approval for this school?',
          type: 'info',
          buttons: [
            {
              text: 'Later',
              style: 'cancel',
              onPress: () => router.replace('/screens/account'),
            },
            {
              text: 'Switch Now',
              onPress: async () => {
                try {
                  const supabase = assertSupabase();
                  const { data: school } = await supabase
                    .from('preschools')
                    .select('id, name, logo_url')
                    .eq('id', result.schoolId)
                    .maybeSingle();

                  await supabase
                    .from('profiles')
                    .update({
                      role: 'teacher',
                      preschool_id: result.schoolId,
                      organization_id: result.schoolId,
                    })
                    .eq('id', user.id);

                  await setActiveOrganization({
                    id: result.schoolId,
                    name: school?.name || 'School',
                    logo_url: school?.logo_url || undefined,
                    type: 'preschool',
                    role: 'teacher',
                  }, user.id);

                  router.replace('/screens/teacher-approval-pending');
                } catch (e: any) {
                  showAlert({ title: 'Error', message: e?.message || 'Failed to switch schools', type: 'error' });
                }
              },
            },
          ],
        });
        return;
      }

      showAlert({
        title: 'Invite accepted',
        message: 'Your invite was accepted. The principal will review and activate your account.',
        type: 'success',
      });
      router.replace('/screens/teacher-approval-pending');
    } catch (e: any) {
      showAlert({ title: 'Error', message: e?.message || 'Failed to accept invite', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user?.id) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Accept Teacher Invite' }} />
        <Text style={styles.title}>Accept Teacher Invite</Text>
        <Text style={styles.helper}>
          Sign in or create an account to continue. We’ll keep your invite token ready.
        </Text>
        <Text style={styles.label}>Paste invite link (from email)</Text>
        <TextInput style={styles.input} onChangeText={handleLinkInputChange} autoCapitalize="none" placeholder="Paste full link" placeholderTextColor="#64748b" />
        <Text style={styles.label}>Or enter manually: Token</Text>
        <TextInput style={styles.input} value={token} onChangeText={setToken} autoCapitalize="none" placeholder="Invite token" placeholderTextColor="#64748b" />
        <Text style={styles.label}>Your email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor="#64748b" />
        <TouchableOpacity style={styles.button} onPress={handleSignIn}>
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleSignUp}>
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Create Account</Text>
        </TouchableOpacity>
        <AlertModal {...alertProps} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Accept Teacher Invite' }} />
      <Text style={styles.title}>Accept your invite</Text>
      <Text style={styles.helper}>
        Paste the link from your invitation email, or enter token and email below.
      </Text>
      <Text style={styles.label}>Paste invite link (from email)</Text>
      <TextInput style={styles.input} onChangeText={handleLinkInputChange} autoCapitalize="none" placeholder="Paste full link – we'll extract your invite details" placeholderTextColor="#64748b" />
      <Text style={styles.label}>Or enter manually: Token</Text>
      <TextInput style={styles.input} value={token} onChangeText={setToken} autoCapitalize="none" placeholder="Invite token" placeholderTextColor="#64748b" />
      <Text style={styles.label}>Your email</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor="#64748b" />
      <TouchableOpacity disabled={submitting} style={styles.button} onPress={onAccept}>
        <Text style={styles.buttonText}>{submitting ? 'Submitting…' : 'Accept Invite'}</Text>
      </TouchableOpacity>
      <AlertModal {...alertProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#0b1220' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  helper: { color: '#94a3b8', fontSize: 13, marginBottom: 12 },
  label: { color: '#fff', marginTop: 8, marginBottom: 6 },
  input: { backgroundColor: '#111827', color: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#1f2937', padding: 12 },
  button: { marginTop: 16, backgroundColor: '#00f5ff', padding: 12, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#000', fontWeight: '800' },
  secondaryButton: { backgroundColor: '#1f2937' },
  secondaryButtonText: { color: '#e2e8f0' },
});
