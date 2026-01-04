/**
 * Member Invite Handler
 * Handles deep links for member/youth invites
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { useEduDashAlert } from '@/components/ui/EduDashAlert';

export default function MemberInviteScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showAlert, AlertComponent } = useEduDashAlert();

  const [loading, setLoading] = useState(true);
  const [inviteDetails, setInviteDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    validateInvite();
  }, [code]);

  const validateInvite = async () => {
    if (!code) {
      setError('No invite code provided');
      setLoading(false);
      return;
    }

    try {
      const supabase = assertSupabase();
      
      // Look up the invite code - use maybeSingle() to avoid 406 when no results
      const { data, error: queryError } = await supabase
        .from('join_requests')
        .select(`
          *,
          organizations:organization_id (
            id,
            name,
            logo_url
          )
        `)
        .eq('invite_code', code.toUpperCase())
        .eq('status', 'pending')
        .maybeSingle();

      if (queryError || !data) {
        setError('Invalid or expired invite code');
        setLoading(false);
        return;
      }

      // Check expiry
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setError('This invite code has expired');
        setLoading(false);
        return;
      }

      setInviteDetails(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to validate invite');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user || !inviteDetails) {
      // Redirect to sign up/login with the code preserved
      router.push(`/sign-up?inviteCode=${code}`);
      return;
    }

    setJoining(true);
    try {
      const supabase = assertSupabase();

      // Create organization membership
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          user_id: user.id,
          organization_id: inviteDetails.organization_id,
          member_type: inviteDetails.requested_role || 'youth_member',
          membership_status: 'active',
          joined_via: 'invite_code',
          invite_code_used: code,
        });

      if (memberError) throw memberError;

      // Update the join request as used (optional - mark who used it)
      await supabase
        .from('join_requests')
        .update({ 
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', inviteDetails.id);

      // Update user's profile with organization
      await supabase
        .from('profiles')
        .update({
          organization_id: inviteDetails.organization_id,
          member_type: inviteDetails.requested_role || 'youth_member',
        })
        .eq('id', user.id);

      showAlert({
        type: 'success',
        title: 'Welcome!',
        message: `You've successfully joined ${inviteDetails.organizations?.name || 'the organization'}!`,
        buttons: [
          { text: 'Continue', style: 'default', onPress: () => router.replace('/') }
        ],
      });
    } catch (e: any) {
      // Handle duplicate key error - user is already a member
      if (e?.code === '23505') {
        showAlert({
          type: 'info',
          title: 'Already a Member',
          message: `You're already a member of ${inviteDetails?.organizations?.name || 'this organization'}. No need to join again!`,
          buttons: [
            { text: 'Go to Dashboard', style: 'default', onPress: () => router.replace('/') }
          ],
        });
      } else {
        showAlert({
          type: 'error',
          title: 'Unable to Join',
          message: e?.message || 'Failed to join organization. Please try again.',
          buttons: [{ text: 'OK', style: 'default' }],
        });
      }
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Validating invite code...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <Ionicons name="close-circle" size={64} color="#EF4444" />
          <Text style={[styles.errorTitle, { color: theme.text }]}>Invalid Invite</Text>
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.buttonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
            <Ionicons name="people" size={48} color={theme.primary} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>You&apos;re Invited!</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Join {inviteDetails?.organizations?.name || 'the organization'}
          </Text>
        </View>

        {/* Invite Details */}
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Invite Code</Text>
            <Text style={[styles.value, { color: theme.primary }]}>{code}</Text>
          </View>
          
          {inviteDetails?.requested_role && (
            <View style={styles.detailRow}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Position</Text>
              <Text style={[styles.value, { color: theme.text }]}>
                {inviteDetails.requested_role.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
              </Text>
            </View>
          )}

          {inviteDetails?.message && (
            <View style={styles.detailRow}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Message</Text>
              <Text style={[styles.value, { color: theme.text }]}>{inviteDetails.message}</Text>
            </View>
          )}

          {inviteDetails?.expires_at && (
            <View style={styles.detailRow}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Expires</Text>
              <Text style={[styles.value, { color: theme.text }]}>
                {new Date(inviteDetails.expires_at).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.joinButton, { backgroundColor: theme.primary }]}
          onPress={handleJoin}
          disabled={joining}
        >
          {joining ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
              <Text style={styles.joinButtonText}>
                {user ? 'Join Now' : 'Sign Up to Join'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {!user && (
          <TouchableOpacity
            style={styles.signInLink}
            onPress={() => router.push(`/sign-in?inviteCode=${code}`)}
          >
            <Text style={[styles.signInText, { color: theme.textSecondary }]}>
              Already have an account? <Text style={{ color: theme.primary }}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <AlertComponent />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    padding: 24,
    paddingTop: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  detailRow: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  signInLink: {
    alignItems: 'center',
    padding: 12,
  },
  signInText: {
    fontSize: 14,
  },
});
