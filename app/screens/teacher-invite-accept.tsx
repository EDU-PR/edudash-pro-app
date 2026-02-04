import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { setActiveOrganization } from '@/components/account/OrganizationSwitcher';
import { setPendingTeacherInvite } from '@/lib/utils/teacherInvitePending';

export default function TeacherInviteAcceptScreen() {
  const { user } = useAuth();
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Prefill from deep link params if present
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  React.useEffect(() => {
    if (typeof params?.token === 'string' && params.token) setToken(String(params.token));
    if (typeof params?.email === 'string' && params.email) setEmail(String(params.email));
  }, [params?.token, params?.email]);

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
      Alert.alert(
        'Sign in required',
        'Please sign in or create an account to accept this invite.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: handleSignIn },
          { text: 'Create Account', onPress: handleSignUp },
        ]
      );
      return;
    }
    if (!token.trim() || !email.trim()) {
      Alert.alert('Missing info', 'Enter the invite token and email.');
      return;
    }
    try {
      setSubmitting(true);
      const { TeacherInviteService } = await import('@/lib/services/teacherInviteService');
      const result = await TeacherInviteService.accept({ token: token.trim(), authUserId: user.id, email: email.trim() });

      if (result.status === 'requires_switch') {
        Alert.alert(
          'Invite accepted',
          'You are already linked to another school. Switch to this school now to access teacher tools?',
          [
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

                  router.replace('/screens/teacher-dashboard');
                } catch (e: any) {
                  Alert.alert('Error', e?.message || 'Failed to switch schools');
                }
              },
            },
          ]
        );
        return;
      }

      Alert.alert('Invite accepted', 'Your account has been linked as a teacher.');
      router.replace('/screens/teacher-dashboard');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to accept invite');
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
        <Text style={styles.label}>Invite token</Text>
        <TextInput style={styles.input} value={token} onChangeText={setToken} autoCapitalize="none" placeholder="Paste the invite token" />
        <Text style={styles.label}>Your email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
        <TouchableOpacity style={styles.button} onPress={handleSignIn}>
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleSignUp}>
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Create Account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Accept Teacher Invite' }} />
      <Text style={styles.title}>Enter your invite token</Text>
      <Text style={styles.label}>Invite token</Text>
      <TextInput style={styles.input} value={token} onChangeText={setToken} autoCapitalize="none" placeholder="Paste the invite token" />
      <Text style={styles.label}>Your email</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
      <TouchableOpacity disabled={submitting} style={styles.button} onPress={onAccept}>
        <Text style={styles.buttonText}>{submitting ? 'Submitting…' : 'Accept Invite'}</Text>
      </TouchableOpacity>
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
