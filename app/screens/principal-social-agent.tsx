import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { EnhancedInput } from '@/components/ui/EnhancedInput';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { useSocialAgent, SCHEDULE_OPTIONS, CATEGORY_OPTIONS } from '@/hooks/social-agent';

export default function PrincipalSocialAgentScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const organizationId = (profile?.organization_id || (profile as any)?.preschool_id || null) as string | null;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {
    loading, refreshing, connection, posts,
    connectPageId, setConnectPageId, connectPageName, setConnectPageName,
    connectToken, setConnectToken, connecting,
    settingsSaving, agentEnabled, setAgentEnabled,
    autopostEnabled, setAutopostEnabled,
    autopostSchedule, setAutopostSchedule, autopostTime, setAutopostTime,
    defaultCategory, setDefaultCategory, timezone, setTimezone,
    generateCategory, setGenerateCategory, generateContext, setGenerateContext,
    generating, publishingPostId,
    onRefresh, handleConnect, handleDisconnect,
    handleSaveSettings, handleGenerate, handlePublish, handleDeletePost,
    AlertModalComponent,
  } = useSocialAgent(organizationId);

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
          {/* Facebook Connection */}
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
                  <Text style={styles.connectionMeta}>Page ID: {connection.page_id}</Text>
                </View>
                <Button variant="outline" onPress={handleDisconnect}>Disable</Button>
              </View>
            ) : (
              <>
                <Text style={styles.helperText}>
                  Connect a Facebook Page so Dash AI can draft and publish posts on your behalf.
                </Text>
                <EnhancedInput label="Facebook Page ID" value={connectPageId}
                  onChangeText={setConnectPageId} placeholder="e.g. 1234567890" autoCapitalize="none" />
                <EnhancedInput label="Page Name (optional)" value={connectPageName}
                  onChangeText={setConnectPageName} placeholder="e.g. Sunshine Primary School" />
                <EnhancedInput label="Page Access Token" value={connectToken}
                  onChangeText={setConnectToken} placeholder="Paste token" autoCapitalize="none" secureTextEntry />
                <Button onPress={handleConnect} loading={connecting} disabled={connecting}>
                  Connect Facebook Page
                </Button>
                <Text style={styles.tinyNote}>
                  Tokens are stored encrypted and are never shown back in the app.
                </Text>
              </>
            )}
          </Card>

          {/* Agent Settings */}
          <Card style={styles.card} elevation="medium">
            <View style={styles.sectionTitleRow}>
              <Ionicons name="sparkles" size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>Agent Settings</Text>
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Enable Social Agent</Text>
                <Text style={styles.toggleHint}>
                  Turns on drafts, scheduling, and cron jobs for this school.
                </Text>
              </View>
              <Switch value={agentEnabled} onValueChange={setAgentEnabled} />
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Autopost</Text>
                <Text style={styles.toggleHint}>
                  Creates a safe, generic post automatically on schedule.
                </Text>
              </View>
              <Switch value={autopostEnabled} onValueChange={setAutopostEnabled} />
            </View>

            <Text style={styles.subLabel}>Autopost Schedule</Text>
            <View style={styles.pillsRow}>
              {SCHEDULE_OPTIONS.map((opt) => (
                <Button key={opt.id} variant={autopostSchedule === opt.id ? 'primary' : 'outline'}
                  size="small" onPress={() => setAutopostSchedule(opt.id)} style={styles.pill}>
                  {opt.label}
                </Button>
              ))}
            </View>

            <EnhancedInput label="Autopost Time (local)" value={autopostTime}
              onChangeText={setAutopostTime} placeholder="08:00" autoCapitalize="none" />
            <EnhancedInput label="Timezone (optional)" value={timezone}
              onChangeText={setTimezone} placeholder="e.g. Africa/Johannesburg" autoCapitalize="none" />

            <Text style={styles.subLabel}>Default Category</Text>
            <View style={styles.pillsRow}>
              {CATEGORY_OPTIONS.slice(0, 4).map((opt) => (
                <Button key={opt.id} variant={defaultCategory === opt.id ? 'primary' : 'outline'}
                  size="small" onPress={() => setDefaultCategory(opt.id)} style={styles.pill}>
                  {opt.label}
                </Button>
              ))}
            </View>

            <Button onPress={handleSaveSettings} loading={settingsSaving} disabled={settingsSaving}>
              Save Settings
            </Button>
            <Text style={styles.tinyNote}>
              Autopost requires cron: `social-agent-daily-cron` and `social-publisher-cron`.
            </Text>
          </Card>

          {/* Generate Draft */}
          <Card style={styles.card} elevation="medium">
            <View style={styles.sectionTitleRow}>
              <Ionicons name="create" size={18} color={theme.info} />
              <Text style={styles.sectionTitle}>Generate Draft</Text>
            </View>

            <Text style={styles.subLabel}>Category</Text>
            <View style={styles.pillsRow}>
              {CATEGORY_OPTIONS.map((opt) => (
                <Button key={opt.id} variant={generateCategory === opt.id ? 'primary' : 'outline'}
                  size="small" onPress={() => setGenerateCategory(opt.id)} style={styles.pill}>
                  {opt.label}
                </Button>
              ))}
            </View>

            <EnhancedInput label="Context (optional)" value={generateContext}
              onChangeText={setGenerateContext} multiline style={{ minHeight: 120 }}
              placeholder="Optional: add an event, reminder, or topic. Avoid student names." />

            <Button onPress={handleGenerate} loading={generating}
              disabled={generating || !connection?.is_active}>
              Generate Draft
            </Button>
            {!connection?.is_active && (
              <Text style={[styles.tinyNote, { color: theme.warning }]}>
                Connect Facebook first to generate drafts.
              </Text>
            )}
          </Card>

          {/* Queue */}
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
                        {p.scheduled_at && (
                          <Text style={styles.postMeta}>
                            Scheduled: {new Date(p.scheduled_at).toLocaleString()}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.postBody} numberOfLines={6}>{p.content}</Text>
                      {p.error_message && (
                        <Text style={[styles.postMeta, { color: theme.error }]}>
                          Error: {p.error_message}
                        </Text>
                      )}
                      <View style={styles.postActions}>
                        <Button variant="primary" size="small"
                          disabled={!canPublish || !connection?.is_active}
                          loading={publishing} onPress={() => handlePublish(p.id)}>
                          {publishLabel}
                        </Button>
                        <Button variant="outline" size="small"
                          onPress={() => handleDeletePost(p.id)}>
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
      <AlertModalComponent />
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
      borderWidth: 1, borderColor: theme.border, borderRadius: 12,
      padding: 12, backgroundColor: theme.surface, gap: 10,
    },
    postHeaderRow: { gap: 4 },
    postTitle: { fontSize: 13, fontWeight: '700', color: theme.text },
    postMeta: { fontSize: 12, color: theme.textSecondary },
    postBody: { fontSize: 13, color: theme.text, lineHeight: 18 },
    postActions: { flexDirection: 'row', gap: 10 },
  });
