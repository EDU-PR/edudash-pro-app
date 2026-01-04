/**
 * Youth President Invite Code Generator
 * Generate and share invite codes for recruiting youth members
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  ScrollView, 
  Switch, 
  Share, 
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';

let Clipboard: any = null;
try { Clipboard = require('expo-clipboard'); } catch (e) { /* optional */ }

interface YouthInviteCode {
  id: string;
  code: string;
  organization_id: string;
  created_by: string;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  expires_at: string | null;
  description: string;
  created_at: string;
}

export default function YouthInviteCodeScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const organizationId = profile?.organization_id as string | null;

  const [codes, setCodes] = useState<YouthInviteCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // New code form
  const [unlimited, setUnlimited] = useState(true);
  const [maxUses, setMaxUses] = useState('50');
  const [expiryDays, setExpiryDays] = useState('30');
  const [description, setDescription] = useState('Youth Wing Invite');

  const loadCodes = useCallback(async () => {
    if (!organizationId) return;
    try {
      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from('join_requests')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('request_type', 'member_join')
        .not('invite_code', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      
      // Map to our interface format
      const mapped = (data || []).map((r: any) => ({
        id: r.id,
        code: r.invite_code,
        organization_id: r.organization_id,
        created_by: r.invited_by, // Fixed: was inviter_id
        max_uses: null, // Column doesn't exist in DB
        current_uses: 0, // Column doesn't exist in DB
        is_active: r.status === 'pending',
        expires_at: r.expires_at,
        description: r.message || 'Youth Invite', // Fixed: was notes
        created_at: r.created_at,
      }));
      setCodes(mapped);
    } catch (e: any) {
      console.error('Failed to load codes:', e);
    } finally {
      setInitialLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { loadCodes(); }, [loadCodes]);

  const generateInviteCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I,O,0,1 for readability
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const onGenerate = async () => {
    if (!organizationId || !user?.id) {
      Alert.alert('Missing context', 'You need to be part of an organization to create invites.');
      return;
    }
    
    setLoading(true);
    try {
      const supabase = assertSupabase();
      const days = Number(expiryDays);
      const expiresAt = isFinite(days) && days > 0
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const inviteCode = generateInviteCode();
      
      const { data, error } = await supabase
        .from('join_requests')
        .insert({
          organization_id: organizationId,
          request_type: 'member_join',
          invite_code: inviteCode,
          invited_by: user.id,
          requester_id: user.id, // Required by valid_requester constraint
          expires_at: expiresAt,
          message: description, // Use 'message' column instead of 'notes'
          status: 'pending',
          requested_role: 'youth_member', // Explicitly set role for youth wing invites
        })
        .select()
        .single();

      if (error) throw error;

      await loadCodes();
      Alert.alert('Invite Created', `Code: ${inviteCode}\n\nShare this code with potential youth members!`);
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
      } else {
        Alert.alert('Copy failed', 'Clipboard not available');
      }
    } catch {
      Alert.alert('Copy failed', 'Unable to copy');
    }
  };

  const buildShareMessage = (code: string) => {
    const shareUrl = `https://www.soilofafrica.org.za/invite/member?code=${encodeURIComponent(code)}`;
    return `🌱 Join the SOA Youth Wing!\n\nUse invite code: ${code}\n\nDownload the app and enter this code to join:\n${shareUrl}`;
  };

  const shareInvite = async (item: YouthInviteCode) => {
    try {
      const message = buildShareMessage(item.code);
      await Share.share({ message });
    } catch (e: any) {
      Alert.alert('Share failed', e?.message || 'Unable to open share dialog');
    }
  };

  const shareWhatsApp = async (item: YouthInviteCode) => {
    try {
      const message = encodeURIComponent(buildShareMessage(item.code));
      const url = `whatsapp://send?text=${message}`;
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert('WhatsApp Error', 'Unable to open WhatsApp. Please try Share instead.');
    }
  };

  const toggleActive = async (item: YouthInviteCode) => {
    try {
      setLoading(true);
      const supabase = assertSupabase();
      const newStatus = item.is_active ? 'cancelled' : 'pending';
      
      const { error } = await supabase
        .from('join_requests')
        .update({ status: newStatus })
        .eq('id', item.id);
      
      if (error) throw error;
      await loadCodes();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const latest = codes.find(c => c.is_active);

  if (initialLoading) {
    return (
      <DashboardWallpaperBackground>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.text, { marginTop: 12 }]}>Loading...</Text>
          </View>
        </SafeAreaView>
      </DashboardWallpaperBackground>
    );
  }

  return (
    <DashboardWallpaperBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.card }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Recruit Youth Members</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              Generate & share invite codes
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="people-circle" size={32} color="#10B981" />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {!organizationId ? (
            <View style={styles.card}>
              <Ionicons name="alert-circle" size={48} color="#F59E0B" style={{ alignSelf: 'center', marginBottom: 12 }} />
              <Text style={[styles.text, { textAlign: 'center' }]}>
                No organization found on your profile. Contact your administrator.
              </Text>
            </View>
          ) : (
            <>
              {/* Quick Share Latest Code */}
              {latest && (
                <View style={[styles.card, styles.featuredCard]}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.featuredLabel}>Active Invite Code</Text>
                    <View style={[styles.badge, styles.badgeActive]}>
                      <Text style={styles.badgeText}>ACTIVE</Text>
                    </View>
                  </View>
                  <Text style={styles.featuredCode}>{latest.code}</Text>
                  <View style={styles.row}>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.surface }]} onPress={() => copyToClipboard(latest.code)}>
                      <Ionicons name="copy" size={18} color={theme.text} />
                      <Text style={[styles.actionBtnText, { color: theme.text }]}>Copy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary }]} onPress={() => shareInvite(latest)}>
                      <Ionicons name="share-social" size={18} color={theme.onPrimary || '#000'} />
                      <Text style={[styles.actionBtnText, { color: theme.onPrimary || '#000' }]}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#25D366' }]} onPress={() => shareWhatsApp(latest)}>
                      <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                      <Text style={[styles.actionBtnText, { color: '#fff' }]}>WhatsApp</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Create New Code */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Create New Invite</Text>
                
                <View style={styles.fieldRow}>
                  <Text style={styles.inputLabel}>Description</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="e.g. Youth Rally 2026"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                <View style={styles.rowBetween}>
                  <Text style={[styles.label, { color: theme.text }]}>Unlimited uses</Text>
                  <Switch value={unlimited} onValueChange={setUnlimited} />
                </View>

                {!unlimited && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.inputLabel}>Max uses</Text>
                    <TextInput
                      keyboardType="number-pad"
                      value={maxUses}
                      onChangeText={setMaxUses}
                      placeholder="e.g. 50"
                      style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>
                )}

                <View style={styles.fieldRow}>
                  <Text style={styles.inputLabel}>Expires in (days)</Text>
                  <TextInput
                    keyboardType="number-pad"
                    value={expiryDays}
                    onChangeText={setExpiryDays}
                    placeholder="30"
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                <TouchableOpacity 
                  style={[styles.generateBtn, loading && styles.btnDisabled]} 
                  onPress={onGenerate} 
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <>
                      <Ionicons name="add-circle" size={20} color="#000" />
                      <Text style={styles.generateBtnText}>Generate Invite Code</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Existing Codes */}
              <Text style={styles.sectionTitle}>Your Invite Codes ({codes.length})</Text>
              
              {codes.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="ticket-outline" size={48} color={theme.textSecondary} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    No invite codes yet. Generate one above to start recruiting!
                  </Text>
                </View>
              ) : (
                codes.map((item) => {
                  const usesText = item.max_uses 
                    ? `${item.current_uses || 0}/${item.max_uses}` 
                    : `${item.current_uses || 0}/∞`;
                  const expired = item.expires_at && new Date(item.expires_at) < new Date();
                  
                  return (
                    <View key={item.id} style={styles.card}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.code}>{item.code}</Text>
                        <View style={[
                          styles.badge, 
                          expired ? styles.badgeExpired : item.is_active ? styles.badgeActive : styles.badgeInactive
                        ]}>
                          <Text style={styles.badgeText}>
                            {expired ? 'EXPIRED' : item.is_active ? 'ACTIVE' : 'INACTIVE'}
                          </Text>
                        </View>
                      </View>
                      
                      <Text style={[styles.description, { color: theme.textSecondary }]}>{item.description}</Text>
                      
                      <View style={styles.statsRow}>
                        <View style={styles.stat}>
                          <Ionicons name="people" size={16} color={theme.textSecondary} />
                          <Text style={[styles.statText, { color: theme.textSecondary }]}>Uses: {usesText}</Text>
                        </View>
                        <View style={styles.stat}>
                          <Ionicons name="calendar" size={16} color={theme.textSecondary} />
                          <Text style={[styles.statText, { color: theme.textSecondary }]}>
                            {item.expires_at 
                              ? `Expires: ${new Date(item.expires_at).toLocaleDateString()}` 
                              : 'No expiry'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.row}>
                        <TouchableOpacity style={styles.smallBtn} onPress={() => copyToClipboard(item.code)}>
                          <Text style={styles.smallBtnText}>Copy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.smallBtn} onPress={() => shareInvite(item)}>
                          <Text style={styles.smallBtnText}>Share</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.smallBtn, styles.whatsappBtn]} onPress={() => shareWhatsApp(item)}>
                          <Text style={styles.smallBtnTextDark}>WhatsApp</Text>
                        </TouchableOpacity>
                        {!expired && (
                          <TouchableOpacity 
                            style={[styles.smallBtn, item.is_active ? styles.deactivateBtn : styles.activateBtn]} 
                            onPress={() => toggleActive(item)}
                          >
                            <Text style={styles.smallBtnTextDark}>
                              {item.is_active ? 'Deactivate' : 'Activate'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </DashboardWallpaperBackground>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { 
    flex: 1 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#1f2937',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  headerIcon: {
    marginLeft: 12,
  },
  content: { 
    padding: 16,
    paddingBottom: 40,
  },
  text: { 
    color: theme?.text || '#fff' 
  },
  card: { 
    backgroundColor: theme?.card || '#111827', 
    borderRadius: 16, 
    padding: 16, 
    borderColor: theme?.border || '#1f2937', 
    borderWidth: 1, 
    marginBottom: 16 
  },
  featuredCard: {
    backgroundColor: '#10B981' + '15',
    borderColor: '#10B981',
  },
  featuredLabel: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  featuredCode: {
    color: theme?.text || '#fff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
    marginVertical: 16,
  },
  sectionTitle: { 
    color: theme?.text || '#fff', 
    fontSize: 16, 
    fontWeight: '700', 
    marginBottom: 12 
  },
  rowBetween: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 8,
  },
  row: { 
    flexDirection: 'row', 
    gap: 8, 
    marginTop: 12 
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
  },
  fieldRow: { 
    marginBottom: 16 
  },
  label: { 
    fontSize: 14,
    fontWeight: '600',
  },
  inputLabel: { 
    color: theme?.text || '#fff', 
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  input: { 
    borderRadius: 10, 
    borderWidth: 1, 
    padding: 12,
    fontSize: 15,
  },
  code: { 
    color: theme?.text || '#fff', 
    fontSize: 20, 
    fontWeight: '800',
    letterSpacing: 2,
  },
  description: {
    fontSize: 13,
    marginTop: 4,
  },
  badge: { 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 8 
  },
  badgeActive: { 
    backgroundColor: '#10B981' 
  },
  badgeInactive: { 
    backgroundColor: '#6B7280' 
  },
  badgeExpired: {
    backgroundColor: '#EF4444',
  },
  badgeText: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 10 
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 10,
  },
  actionBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
  generateBtn: { 
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981', 
    padding: 14, 
    borderRadius: 12,
  },
  btnDisabled: { 
    opacity: 0.7 
  },
  generateBtnText: { 
    color: '#000', 
    fontWeight: '800',
    fontSize: 15,
  },
  smallBtn: { 
    flex: 1, 
    backgroundColor: theme?.surface || '#1f2937', 
    padding: 10, 
    borderRadius: 8, 
    alignItems: 'center', 
    borderColor: theme?.border || '#374151', 
    borderWidth: 1 
  },
  smallBtnText: { 
    color: theme?.text || '#fff', 
    fontWeight: '600',
    fontSize: 12,
  },
  smallBtnTextDark: { 
    color: '#000',
    fontWeight: '600',
    fontSize: 12,
  },
  deactivateBtn: { 
    backgroundColor: '#F59E0B' 
  },
  activateBtn: { 
    backgroundColor: '#22C55E' 
  },
  whatsappBtn: { 
    backgroundColor: '#25D366' 
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
  },
});
