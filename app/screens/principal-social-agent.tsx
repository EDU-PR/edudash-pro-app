import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { EnhancedInput } from '@/components/ui/EnhancedInput';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

type AutopostSchedule = 'mon_wed_fri' | 'weekdays' | 'daily' | 'off';
type SocialCategory = 'word_of_day' | 'study_tip' | 'parent_tip' | 'value_of_week' | 'school_update' | 'custom';

type SocialConnection = {
  id: string;
  platform: 'facebook_page';
  page_id: string;
  page_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SocialPost = {
  id: string;
  category: SocialCategory;
  status: string;
  content: string;
  scheduled_at: string | null;
  published_at: string | null;
  external_post_id: string | null;
  error_message: string | null;
  created_at: string;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function normalizeTimeHHMMToHHMMSS(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) return '08:00:00';
  const parts = raw.split(':').map((p) => p.trim());
  const hour = Math.max(0, Math.min(23, Number(parts[0] || 8)));
  const min = Math.max(0, Math.min(59, Number(parts[1] || 0)));
  const sec = Math.max(0, Math.min(59, Number((parts[2] || '0').split('.')[0] || 0)));
  if (Number.isNaN(hour) || Number.isNaN(min) || Number.isNaN(sec)) return '08:00:00';
  return `${pad2(hour)}:${pad2(min)}:${pad2(sec)}`;
}

export default function PrincipalSocialAgentScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();

  const organizationId = (profile?.organization_id || (profile as any)?.preschool_id || null) as string | null;

  const styles = useMemo(() => createStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [connection, setConnection] = useState<SocialConnection | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);

  const [connectPageId, setConnectPageId] = useState('');
  const [connectPageName, setConnectPageName] = useState('');
  const [connectToken, setConnectToken] = useState('');
  const [connecting, setConnecting] = useState(false);

  const [settingsSaving, setSettingsSaving] = useState(false);
  const [agentEnabled, setAgentEnabled] = useState(false);
  const [autopostEnabled, setAutopostEnabled] = useState(false);
  const [autopostSchedule, setAutopostSchedule] = useState<AutopostSchedule>('mon_wed_fri');
  const [autopostTime, setAutopostTime] = useState('08:00');
  const [defaultCategory, setDefaultCategory] = useState<SocialCategory>('study_tip');
  const [timezone, setTimezone] = useState<string>('');

  const [generateCategory, setGenerateCategory] = useState<SocialCategory>('study_tip');
  const [generateContext, setGenerateContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [publishingPostId, setPublishingPostId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      const supabase = assertSupabase();

      const [connRes, settingsRes, postsRes] = await Promise.all([
        supabase
          .from('social_connections')
          .select('id, platform, page_id, page_name, is_active, created_at, updated_at')
          .eq('organization_id', organizationId)
          .eq('platform', 'facebook_page')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('social_agent_settings')
          .select('organization_id, enabled, autopost_enabled, autopost_schedule, autopost_time_local, timezone, default_category')
          .eq('organization_id', organizationId)
          .maybeSingle(),
        supabase
          .from('social_posts')
          .select('id, category, status, content, scheduled_at, published_at, external_post_id, error_message, created_at')
          .eq('organization_id', organizationId)
          .eq('platform', 'facebook_page')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (connRes.error) console.debug('[SocialAgent] connection load error', connRes.error);
      if (settingsRes.error) console.debug('[SocialAgent] settings load error', settingsRes.error);
      if (postsRes.error) console.debug('[SocialAgent] posts load error', postsRes.error);

      setConnection((connRes.data as any) || null);
      setPosts(((postsRes.data as any) || []) as SocialPost[]);

      const s = settingsRes.data as any;
      if (s?.organization_id) {
        setAgentEnabled(Boolean(s.enabled));
        setAutopostEnabled(Boolean(s.autopost_enabled));
        setAutopostSchedule((s.autopost_schedule as AutopostSchedule) || 'mon_wed_fri');
        setAutopostTime(String(s.autopost_time_local || '08:00:00').slice(0, 5));
        setDefaultCategory((s.default_category as SocialCategory) || 'study_tip');
        setGenerateCategory((s.default_category as SocialCategory) || 'study_tip');
        setTimezone(s.timezone ? String(s.timezone) : '');
      }
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }, [loadAll]);

  const handleConnect = useCallback(async () => {
    if (!organizationId) return;
    if (!connectPageId.trim() || !connectToken.trim()) {
      Alert.alert('Missing info', 'Please provide Page ID and Page Access Token.');
      return;
    }

    try {
      setConnecting(true);
      const supabase = assertSupabase();
      const { data, error } = await supabase.functions.invoke('social-facebook-connect', {
        body: {
          page_id: connectPageId.trim(),
          page_name: connectPageName.trim() || undefined,
          page_access_token: connectToken.trim(),
        },
      });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.message || 'Failed to connect Facebook Page');
      }

      setConnectToken('');
      Alert.alert('Connected', 'Facebook Page connected successfully.');
      await loadAll();
    } catch (e: any) {
      const msg = e?.message || 'Failed to connect Facebook Page';
      Alert.alert('Connect failed', msg);
    } finally {
      setConnecting(false);
    }
  }, [organizationId, connectPageId, connectToken, connectPageName, loadAll]);

  const handleDisconnect = useCallback(async () => {
    if (!organizationId || !connection?.id) return;
    try {
      const supabase = assertSupabase();
      const { error } = await supabase
        .from('social_connections')
        .update({ is_active: false })
        .eq('id', connection.id)
        .eq('organization_id', organizationId);
      if (error) throw error;
      Alert.alert('Disconnected', 'Facebook Page connection disabled.');
      await loadAll();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to disconnect');
    }
  }, [organizationId, connection?.id, loadAll]);

  const handleSaveSettings = useCallback(async () => {
    if (!organizationId) return;
    try {
      setSettingsSaving(true);
      const supabase = assertSupabase();

      const payload = {
        organization_id: organizationId,
        enabled: agentEnabled,
        autopost_enabled: autopostEnabled,
        autopost_schedule: autopostSchedule,
        autopost_time_local: normalizeTimeHHMMToHHMMSS(autopostTime),
        timezone: timezone.trim() || null,
        default_category: defaultCategory,
        updated_by: profile?.id || null,
        created_by: profile?.id || null,
      };

      const { error } = await supabase
        .from('social_agent_settings')
        .upsert(payload as any, { onConflict: 'organization_id' });

      if (error) throw error;

      Alert.alert('Saved', 'Social Agent settings updated.');
      await loadAll();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  }, [organizationId, agentEnabled, autopostEnabled, autopostSchedule, autopostTime, timezone, defaultCategory, profile?.id, loadAll]);

  const handleGenerate = useCallback(async () => {
    if (!organizationId) return;
    try {
      setGenerating(true);
      const supabase = assertSupabase();
      const { data, error } = await supabase.functions.invoke('social-agent-generate', {
        body: {
          category: generateCategory,
          context: generateContext.trim() || undefined,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Generation failed');
      Alert.alert('Draft created', 'A new post draft has been added to your queue.');
      setGenerateContext('');
      await loadAll();
    } catch (e: any) {
      Alert.alert('Generation failed', e?.message || 'Failed to generate draft');
    } finally {
      setGenerating(false);
    }
  }, [organizationId, generateCategory, generateContext, loadAll]);

  const handlePublish = useCallback(async (postId: string) => {
    if (!organizationId) return;
    try {
      setPublishingPostId(postId);
      const supabase = assertSupabase();
      const { data, error } = await supabase.functions.invoke('social-facebook-publish', {
        body: { post_id: postId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Publish failed');
      Alert.alert('Published', 'Post published to Facebook.');
      await loadAll();
    } catch (e: any) {
      Alert.alert('Publish failed', e?.message || 'Failed to publish');
      await loadAll();
    } finally {
      setPublishingPostId(null);
    }
  }, [organizationId, loadAll]);

  const scheduleOptions: Array<{ id: AutopostSchedule; label: string; hint: string }> = [
    { id: 'mon_wed_fri', label: 'Mon/Wed/Fri', hint: 'Light posting' },
    { id: 'weekdays', label: 'Weekdays', hint: 'School days' },
    { id: 'daily', label: 'Daily', hint: 'Every day' },
    { id: 'off', label: 'Off', hint: 'No autopost' },
  ];

  const categoryOptions: Array<{ id: SocialCategory; label: string; hint: string }> = [
    { id: 'study_tip', label: 'Study Tip', hint: 'Quick learning tip' },
    { id: 'parent_tip', label: 'Parent Tip', hint: 'Support at home' },
    { id: 'word_of_day', label: 'Word of Day', hint: 'Vocabulary' },
    { id: 'value_of_week', label: 'Value of Week', hint: 'Character focus' },
    { id: 'school_update', label: 'School Update', hint: 'Needs approval' },
    { id: 'custom', label: 'Custom', hint: 'Use context' },
  ];

  if (!organizationId) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.text }}>No organization found for your profile.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Social Agent" subtitle="Facebook Pages (autonomous + approval)" />

      {loading ? (
        <View style={styles.loading}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={{ color: theme.textSecondary }}>Loading Social Agent…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card style={styles.card} elevation="medium">
            <View style={styles.sectionTitleRow}>
              <Ionicons name="logo-facebook" size={18} color="#1877F2" />
              <Text style={styles.sectionTitle}>Facebook Connection</Text>
            </View>

            {connection?.id && connection.is_active ? (
              <View style={styles.connectionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.connectionName}>
                    {connection.page_name || 'Facebook Page'}
                  </Text>
                  <Text style={styles.connectionMeta}>
                    Page ID: {connection.page_id}
                  </Text>
                </View>
                <Button variant="outline" onPress={handleDisconnect}>
                  Disable
                </Button>
              </View>
            ) : (
              <>
                <Text style={styles.helperText}>
                  Connect a Facebook Page so Dash AI can draft and publish posts on your behalf.
                </Text>
                <EnhancedInput
                  label="Facebook Page ID"
                  value={connectPageId}
                  onChangeText={setConnectPageId}
                  placeholder="e.g. 1234567890"
                  autoCapitalize="none"
                />
                <EnhancedInput
                  label="Page Name (optional)"
                  value={connectPageName}
                  onChangeText={setConnectPageName}
                  placeholder="e.g. Sunshine Primary School"
                />
                <EnhancedInput
                  label="Page Access Token"
                  value={connectToken}
                  onChangeText={setConnectToken}
                  placeholder="Paste token"
                  autoCapitalize="none"
                  secureTextEntry
                />
                <Button onPress={handleConnect} loading={connecting} disabled={connecting}>
                  Connect Facebook Page
                </Button>
                <Text style={styles.tinyNote}>
                  Tokens are stored encrypted and are never shown back in the app.
                </Text>
              </>
            )}
          </Card>

          <Card style={styles.card} elevation="medium">
            <View style={styles.sectionTitleRow}>
              <Ionicons name="sparkles" size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>Agent Settings</Text>
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Enable Social Agent</Text>
                <Text style={styles.toggleHint}>Turns on drafts, scheduling, and cron jobs for this school.</Text>
              </View>
              <Switch value={agentEnabled} onValueChange={setAgentEnabled} />
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Autopost</Text>
                <Text style={styles.toggleHint}>Creates a safe, generic post automatically on schedule.</Text>
              </View>
              <Switch value={autopostEnabled} onValueChange={setAutopostEnabled} />
            </View>

            <Text style={styles.subLabel}>Autopost Schedule</Text>
            <View style={styles.pillsRow}>
              {scheduleOptions.map((opt) => {
                const active = autopostSchedule === opt.id;
                return (
                  <Button
                    key={opt.id}
                    variant={active ? 'primary' : 'outline'}
                    size="small"
                    onPress={() => setAutopostSchedule(opt.id)}
                    style={styles.pill}
                  >
                    {opt.label}
                  </Button>
                );
              })}
            </View>

            <EnhancedInput
              label="Autopost Time (local)"
              value={autopostTime}
              onChangeText={setAutopostTime}
              placeholder="08:00"
              autoCapitalize="none"
            />

            <EnhancedInput
              label="Timezone (optional)"
              value={timezone}
              onChangeText={setTimezone}
              placeholder="e.g. Africa/Johannesburg"
              autoCapitalize="none"
            />

            <Text style={styles.subLabel}>Default Category</Text>
            <View style={styles.pillsRow}>
              {categoryOptions.slice(0, 4).map((opt) => {
                const active = defaultCategory === opt.id;
                return (
                  <Button
                    key={opt.id}
                    variant={active ? 'primary' : 'outline'}
                    size="small"
                    onPress={() => setDefaultCategory(opt.id)}
                    style={styles.pill}
                  >
                    {opt.label}
                  </Button>
                );
              })}
            </View>

            <Button onPress={handleSaveSettings} loading={settingsSaving} disabled={settingsSaving}>
              Save Settings
            </Button>

            <Text style={styles.tinyNote}>
              Autopost requires cron: `social-agent-daily-cron` and `social-publisher-cron`.
            </Text>
          </Card>

          <Card style={styles.card} elevation="medium">
            <View style={styles.sectionTitleRow}>
              <Ionicons name="create" size={18} color={theme.info} />
              <Text style={styles.sectionTitle}>Generate Draft</Text>
            </View>

            <Text style={styles.subLabel}>Category</Text>
            <View style={styles.pillsRow}>
              {categoryOptions.map((opt) => {
                const active = generateCategory === opt.id;
                return (
                  <Button
                    key={opt.id}
                    variant={active ? 'primary' : 'outline'}
                    size="small"
                    onPress={() => setGenerateCategory(opt.id)}
                    style={styles.pill}
                  >
                    {opt.label}
                  </Button>
                );
              })}
            </View>

            <EnhancedInput
              label="Context (optional)"
              value={generateContext}
              onChangeText={setGenerateContext}
              placeholder="Optional: add an event, reminder, or topic. Avoid student names."
              multiline
              style={{ minHeight: 120 }}
            />

            <Button onPress={handleGenerate} loading={generating} disabled={generating || !connection?.is_active}>
              Generate Draft
            </Button>
            {!connection?.is_active ? (
              <Text style={[styles.tinyNote, { color: theme.warning }]}>
                Connect Facebook first to generate drafts.
              </Text>
            ) : null}
          </Card>

          <Card style={styles.card} elevation="medium">
            <View style={styles.sectionTitleRow}>
              <Ionicons name="list" size={18} color={theme.text} />
              <Text style={styles.sectionTitle}>Queue</Text>
            </View>

            <Button variant="outline" onPress={onRefresh} disabled={refreshing} loading={refreshing}>
              Refresh
            </Button>

            {posts.length === 0 ? (
              <Text style={styles.helperText}>No posts yet. Generate a draft to get started.</Text>
            ) : (
              <View style={{ marginTop: 12, gap: 12 }}>
                {posts.map((p) => {
                  const canPublish = p.status !== 'published';
                  const publishing = publishingPostId === p.id;
                  const publishLabel = p.status === 'pending_approval' ? 'Approve & Publish' : 'Publish';
                  return (
                    <View key={p.id} style={styles.postCard}>
                      <View style={styles.postHeaderRow}>
                        <Text style={styles.postTitle}>
                          {p.category.replace(/_/g, ' ')} • {p.status}
                        </Text>
                        {p.scheduled_at ? (
                          <Text style={styles.postMeta}>
                            Scheduled: {new Date(p.scheduled_at).toLocaleString()}
                          </Text>
                        ) : null}
                      </View>

                      <Text style={styles.postBody} numberOfLines={6}>
                        {p.content}
                      </Text>

                      {p.error_message ? (
                        <Text style={[styles.postMeta, { color: theme.error }]}>
                          Error: {p.error_message}
                        </Text>
                      ) : null}

                      <View style={styles.postActions}>
                        <Button
                          variant="primary"
                          size="small"
                          disabled={!canPublish || !connection?.is_active}
                          loading={publishing}
                          onPress={() => handlePublish(p.id)}
                        >
                          {publishLabel}
                        </Button>
                        <Button
                          variant="outline"
                          size="small"
                          onPress={async () => {
                            try {
                              const supabase = assertSupabase();
                              const { error } = await supabase
                                .from('social_posts')
                                .delete()
                                .eq('id', p.id)
                                .eq('organization_id', organizationId);
                              if (error) throw error;
                              await loadAll();
                            } catch (e: any) {
                              Alert.alert('Delete failed', e?.message || 'Failed to delete');
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollContent: { padding: 16, gap: 14, paddingBottom: 40 },
    card: { width: '100%' },
    loading: { padding: 24, alignItems: 'center', gap: 12 },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
    helperText: { color: theme.textSecondary, marginBottom: 12 },
    tinyNote: { color: theme.textSecondary, marginTop: 10, fontSize: 12 },
    connectionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    connectionName: { fontSize: 14, fontWeight: '700', color: theme.text },
    connectionMeta: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    toggleLabel: { fontSize: 14, fontWeight: '700', color: theme.text },
    toggleHint: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    subLabel: { marginTop: 8, marginBottom: 8, fontSize: 13, fontWeight: '700', color: theme.text },
    pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    pill: { marginRight: 0 },
    postCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: theme.surface,
      gap: 10,
    },
    postHeaderRow: { gap: 4 },
    postTitle: { fontSize: 13, fontWeight: '700', color: theme.text },
    postMeta: { fontSize: 12, color: theme.textSecondary },
    postBody: { fontSize: 13, color: theme.text, lineHeight: 18 },
    postActions: { flexDirection: 'row', gap: 10 },
  });
