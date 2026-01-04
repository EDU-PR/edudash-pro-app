/**
 * Youth Executive/Office Structure Invite Screen
 * Invite Secretary, Treasurer, Deputy President, and other office bearers
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  ScrollView, 
  Share, 
  Linking,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';
import { createStyles } from './youth-executive-invite.styles';
import { 
  EXECUTIVE_POSITIONS, 
  ExecutiveInvite, 
  ExecutivePosition,
  getStatusColor, 
  generateInviteCode 
} from './youth-executive-invite.constants';

let Clipboard: any = null;
try { Clipboard = require('expo-clipboard'); } catch (e) { /* optional */ }

export default function YouthExecutiveInviteScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const organizationId = profile?.organization_id as string | null;

  const [invites, setInvites] = useState<ExecutiveInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Invite form state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<ExecutivePosition | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');

  const loadInvites = useCallback(async () => {
    if (!organizationId) return;
    try {
      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from('join_requests')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('request_type', 'staff_invite')
        .not('requested_role', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const mapped = (data || []).map((r: any) => {
        const position = EXECUTIVE_POSITIONS.find(p => p.id === r.requested_role);
        return {
          id: r.id,
          position: r.requested_role || 'unknown',
          position_label: position?.label || r.requested_role || 'Executive',
          email: r.requester_email,
          phone: r.requester_phone,
          invite_code: r.invite_code || '',
          status: r.status,
          created_at: r.created_at,
          expires_at: r.expires_at,
          accepted_by: r.requester_id,
        };
      });
      setInvites(mapped);
    } catch (e: any) {
      console.error('Failed to load executive invites:', e);
    } finally {
      setInitialLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { loadInvites(); }, [loadInvites]);

  const onCreateInvite = async () => {
    if (!organizationId || !user?.id || !selectedPosition) {
      Alert.alert('Error', 'Please select a position to invite.');
      return;
    }
    
    setLoading(true);
    try {
      const supabase = assertSupabase();
      const inviteCode = generateInviteCode();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const insertData: any = {
        organization_id: organizationId,
        request_type: 'staff_invite',
        invite_code: inviteCode,
        invited_by: user.id,
        requester_id: user.id,
        requested_role: selectedPosition.id,
        message: `Executive invite for ${selectedPosition.label} position`,
        status: 'pending',
        expires_at: expiresAt,
      };

      if (inviteEmail.trim()) {
        insertData.requester_email = inviteEmail.trim().toLowerCase();
      }
      if (invitePhone.trim()) {
        insertData.requester_phone = invitePhone.trim();
      }

      const { error } = await supabase
        .from('join_requests')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      await loadInvites();
      setShowInviteModal(false);
      setSelectedPosition(null);
      setInviteEmail('');
      setInvitePhone('');
      
      Alert.alert(
        'Invite Created',
        `${selectedPosition.label} invite code: ${inviteCode}\n\nShare this code with the person you want to appoint.`,
        [
          { text: 'Copy Code', onPress: () => copyToClipboard(inviteCode) },
          { text: 'Share', onPress: () => shareInvite(inviteCode, selectedPosition.label) },
          { text: 'OK' },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create invite');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (value: string) => {
    try {
      if (Clipboard?.setStringAsync) {
        await Clipboard.setStringAsync(value);
        Alert.alert('Copied', 'Invite code copied to clipboard');
      }
    } catch {
      Alert.alert('Copy failed', 'Unable to copy');
    }
  };

  const shareInvite = async (code: string, positionLabel: string) => {
    try {
      const shareUrl = `https://www.soilofafrica.org.za/invite/executive?code=${encodeURIComponent(code)}`;
      const message = `🌟 SOA Youth Wing Executive Invitation\n\nYou've been invited to join as: ${positionLabel}\n\nUse invite code: ${code}\n\nDownload the app and enter this code:\n${shareUrl}`;
      await Share.share({ message });
    } catch (e: any) {
      Alert.alert('Share failed', e?.message || 'Unable to share');
    }
  };

  const shareWhatsApp = async (code: string, positionLabel: string) => {
    try {
      const message = encodeURIComponent(
        `🌟 SOA Youth Wing Executive Invitation\n\nYou've been invited to join as: ${positionLabel}\n\nUse invite code: ${code}`
      );
      await Linking.openURL(`whatsapp://send?text=${message}`);
    } catch {
      Alert.alert('WhatsApp Error', 'Unable to open WhatsApp');
    }
  };

  const revokeInvite = async (invite: ExecutiveInvite) => {
    Alert.alert(
      'Revoke Invite',
      `Are you sure you want to revoke the ${invite.position_label} invite?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = assertSupabase();
              await supabase.from('join_requests').update({ status: 'revoked' }).eq('id', invite.id);
              await loadInvites();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to revoke invite');
            }
          },
        },
      ]
    );
  };

  const filledPositions = useMemo(() => {
    const filled = new Set<string>();
    invites.forEach(inv => { if (inv.status === 'approved') filled.add(inv.position); });
    return filled;
  }, [invites]);

  const pendingInvites = invites.filter(i => i.status === 'pending');
  const historyInvites = invites.filter(i => i.status !== 'pending');

  return (
    <DashboardWallpaperBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen 
          options={{ 
            headerShown: true,
            title: 'Executive Structure',
            headerStyle: { backgroundColor: theme.surface },
            headerTintColor: theme.text,
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
            ),
          }} 
        />

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={[styles.headerCard, { backgroundColor: theme.surface }]}>
            <View style={styles.headerIconContainer}>
              <Ionicons name="people-circle" size={48} color={theme.primary} />
            </View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Youth Executive Committee</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              Invite and manage your office bearers
            </Text>
          </View>

          {/* Position Grid */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Office Positions</Text>
            <View style={styles.positionGrid}>
              {EXECUTIVE_POSITIONS.map((position) => {
                const isFilled = filledPositions.has(position.id);
                const hasPending = invites.some(i => i.position === position.id && i.status === 'pending');
                return (
                  <TouchableOpacity
                    key={position.id}
                    style={[styles.positionCard, { backgroundColor: theme.surface }, isFilled && styles.positionFilled]}
                    onPress={() => { if (!isFilled) { setSelectedPosition(position); setShowInviteModal(true); }}}
                    disabled={isFilled}
                  >
                    <View style={[styles.positionIcon, { backgroundColor: position.color + '20' }]}>
                      <Ionicons name={position.icon as any} size={24} color={position.color} />
                    </View>
                    <Text style={[styles.positionLabel, { color: theme.text }]} numberOfLines={2}>{position.label}</Text>
                    {isFilled ? (
                      <View style={styles.filledBadge}><Ionicons name="checkmark-circle" size={16} color="#10B981" /><Text style={styles.filledText}>Filled</Text></View>
                    ) : hasPending ? (
                      <View style={styles.pendingBadge}><Ionicons name="time" size={14} color="#F59E0B" /><Text style={styles.pendingText}>Pending</Text></View>
                    ) : (
                      <View style={styles.inviteBadge}><Ionicons name="add" size={14} color={theme.primary} /><Text style={[styles.inviteText, { color: theme.primary }]}>Invite</Text></View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Pending Invites */}
          {pendingInvites.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Pending Invites</Text>
              {pendingInvites.map((invite) => (
                <View key={invite.id} style={[styles.inviteCard, { backgroundColor: theme.surface }]}>
                  <View style={styles.inviteHeader}>
                    <View style={styles.inviteInfo}>
                      <Text style={[styles.invitePosition, { color: theme.text }]}>{invite.position_label}</Text>
                      <Text style={[styles.inviteCode, { color: theme.primary }]}>{invite.invite_code}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invite.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(invite.status) }]}>{invite.status}</Text>
                    </View>
                  </View>
                  {invite.expires_at && <Text style={[styles.expiryText, { color: theme.textSecondary }]}>Expires: {new Date(invite.expires_at).toLocaleDateString()}</Text>}
                  <View style={styles.inviteActions}>
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.primary + '20' }]} onPress={() => copyToClipboard(invite.invite_code)}>
                      <Ionicons name="copy" size={16} color={theme.primary} /><Text style={[styles.actionText, { color: theme.primary }]}>Copy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#25D366' + '20' }]} onPress={() => shareWhatsApp(invite.invite_code, invite.position_label)}>
                      <Ionicons name="logo-whatsapp" size={16} color="#25D366" /><Text style={[styles.actionText, { color: '#25D366' }]}>WhatsApp</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#EF4444' + '20' }]} onPress={() => revokeInvite(invite)}>
                      <Ionicons name="close-circle" size={16} color="#EF4444" /><Text style={[styles.actionText, { color: '#EF4444' }]}>Revoke</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* History */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Invite History</Text>
            {initialLoading ? <ActivityIndicator size="small" color={theme.primary} /> : invites.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
                <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No executive invites yet. Start building your team!</Text>
              </View>
            ) : historyInvites.map((invite) => (
              <View key={invite.id} style={[styles.historyCard, { backgroundColor: theme.surface }]}>
                <View style={styles.historyInfo}>
                  <Text style={[styles.historyPosition, { color: theme.text }]}>{invite.position_label}</Text>
                  <Text style={[styles.historyDate, { color: theme.textSecondary }]}>{new Date(invite.created_at).toLocaleDateString()}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invite.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(invite.status) }]}>{invite.status}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Invite Modal */}
        <Modal visible={showInviteModal} animationType="slide" transparent onRequestClose={() => setShowInviteModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Invite {selectedPosition?.label}</Text>
                <TouchableOpacity onPress={() => setShowInviteModal(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Email (Optional)</Text>
                <TextInput style={[styles.textInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} value={inviteEmail} onChangeText={setInviteEmail} placeholder="email@example.com" placeholderTextColor={theme.textSecondary} keyboardType="email-address" autoCapitalize="none" />
                <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 16 }]}>Phone (Optional)</Text>
                <TextInput style={[styles.textInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} value={invitePhone} onChangeText={setInvitePhone} placeholder="+27 XX XXX XXXX" placeholderTextColor={theme.textSecondary} keyboardType="phone-pad" />
                <Text style={[styles.helpText, { color: theme.textSecondary }]}>Leave both empty to generate a general invite code.</Text>
              </View>
              <View style={styles.modalFooter}>
                <TouchableOpacity style={[styles.cancelButton, { borderColor: theme.border }]} onPress={() => setShowInviteModal(false)}>
                  <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.createButton, { backgroundColor: theme.primary }]} onPress={onCreateInvite} disabled={loading}>
                  {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <><Ionicons name="send" size={18} color="#FFFFFF" /><Text style={styles.createButtonText}>Create Invite</Text></>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </DashboardWallpaperBackground>
  );
}
