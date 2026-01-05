/**
 * Executive Invite Handler
 * Handles deep links for executive/office position invites
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';

const POSITION_LABELS: Record<string, string> = {
  deputy_president: 'Deputy President',
  secretary: 'Secretary',
  treasurer: 'Treasurer',
  organizer: 'Organizer',
  communications: 'Communications Officer',
  coordinator: 'Youth Coordinator',
  additional_member: 'Additional Member',
};

export default function ExecutiveInviteScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [inviteDetails, setInviteDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

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
      
      // Use maybeSingle() to avoid 406 when no results found
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
        .eq('request_type', 'staff_invite')
        .eq('status', 'pending')
        .maybeSingle();

      if (queryError || !data) {
        setError('Invalid or expired executive invite code');
        setLoading(false);
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setError('This executive invite has expired');
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

  const handleAccept = async () => {
    if (!user || !inviteDetails) {
      router.push(`/sign-up?inviteCode=${code}&type=executive`);
      return;
    }

    setAccepting(true);
    try {
      const supabase = assertSupabase();
      const position = inviteDetails.requested_role;

      // Use RPC to accept the invite (bypasses RLS with SECURITY DEFINER)
      // First get the invite_token via validate RPC if not already available
      let inviteToken = inviteDetails.invite_token;
      
      if (!inviteToken) {
        const { data: validateResult, error: validateError } = await supabase
          .rpc('validate_join_invite_code', { p_code: code?.toUpperCase() });
        
        if (validateError || !validateResult?.valid) {
          throw new Error(validateError?.message || validateResult?.error || 'Invalid invite code');
        }
        inviteToken = validateResult.invite_token;
      }

      // Accept the invite using the RPC (handles status update with SECURITY DEFINER)
      const { data: acceptResult, error: acceptError } = await supabase
        .rpc('accept_join_request', { p_invite_token: inviteToken });
      
      if (acceptError || !acceptResult?.success) {
        throw new Error(acceptError?.message || acceptResult?.error || 'Failed to accept invitation');
      }

      // Create organization membership with executive position
      // Use upsert to handle case where member already exists
      const { error: memberError } = await supabase
        .from('organization_members')
        .upsert({
          user_id: user.id,
          organization_id: inviteDetails.organization_id,
          member_type: position,
          role: 'admin', // Executive members get admin role
          membership_status: 'active',
          joined_via: 'executive_invite',
          invite_code_used: code,
        }, { onConflict: 'user_id,organization_id' });

      if (memberError) {
        console.warn('Member creation warning:', memberError.message);
        // Don't throw - the invite was accepted, membership may already exist
      }

      // Update user profile
      await supabase
        .from('profiles')
        .update({
          organization_id: inviteDetails.organization_id,
          member_type: position,
          role: 'admin',
        })
        .eq('id', user.id);

      const positionLabel = POSITION_LABELS[position] || position;
      Alert.alert(
        'Congratulations!',
        `You are now the ${positionLabel} of ${inviteDetails.organizations?.name || 'the organization'}!`,
        [{ text: 'OK', onPress: () => router.replace('/') }]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to accept position');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Validating executive invite...
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
            style={[styles.button, { backgroundColor: '#8B5CF6' }]}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.buttonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const positionLabel = POSITION_LABELS[inviteDetails?.requested_role] || inviteDetails?.requested_role || 'Executive';

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: '#8B5CF620' }]}>
            <Ionicons name="ribbon" size={48} color="#8B5CF6" />
          </View>
          <Text style={[styles.badge, { color: '#8B5CF6' }]}>🌟 EXECUTIVE POSITION</Text>
          <Text style={[styles.title, { color: theme.text }]}>{positionLabel}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {inviteDetails?.organizations?.name || 'Youth Wing'}
          </Text>
        </View>

        {/* Details Card */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: '#8B5CF630' }]}>
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Invite Code</Text>
            <Text style={[styles.value, { color: '#8B5CF6' }]}>{code}</Text>
          </View>

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

        {/* Responsibilities Note */}
        <View style={[styles.noteCard, { backgroundColor: '#8B5CF610' }]}>
          <Ionicons name="information-circle" size={20} color="#8B5CF6" />
          <Text style={[styles.noteText, { color: theme.textSecondary }]}>
            As {positionLabel}, you&apos;ll have administrative access to manage the organization.
          </Text>
        </View>

        {/* Accept Button */}
        <TouchableOpacity
          style={[styles.acceptButton, { backgroundColor: '#8B5CF6' }]}
          onPress={handleAccept}
          disabled={accepting}
        >
          {accepting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={24} color="#FFFFFF" />
              <Text style={styles.acceptButtonText}>
                {user ? 'Accept Position' : 'Sign Up to Accept'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {!user && (
          <TouchableOpacity
            style={styles.signInLink}
            onPress={() => router.push(`/sign-in?inviteCode=${code}&type=executive`)}
          >
            <Text style={[styles.signInText, { color: theme.textSecondary }]}>
              Already have an account? <Text style={{ color: '#8B5CF6' }}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
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
  badge: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
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
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  acceptButtonText: {
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
