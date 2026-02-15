/**
 * Hook managing all Social Agent state, data fetching, and mutation callbacks.
 * Extracted from principal-social-agent.tsx for WARP.md compliance.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAlertModal } from '@/components/ui/AlertModal';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { normalizeTimeHHMMToHHMMSS } from './types';
import type { AutopostSchedule, SocialCategory, SocialConnection, SocialPost } from './types';

export function useSocialAgent(organizationId: string | null) {
  const { profile } = useAuth();
  const { showAlert, AlertModalComponent } = useAlertModal();

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
  const [timezone, setTimezone] = useState('');

  const [generateCategory, setGenerateCategory] = useState<SocialCategory>('study_tip');
  const [generateContext, setGenerateContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [publishingPostId, setPublishingPostId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!organizationId) { setLoading(false); return; }
    try {
      const sb = assertSupabase();
      const [connRes, settingsRes, postsRes] = await Promise.all([
        sb.from('social_connections').select('id, platform, page_id, page_name, is_active, created_at, updated_at')
          .eq('organization_id', organizationId).eq('platform', 'facebook_page')
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        sb.from('social_agent_settings')
          .select('organization_id, enabled, autopost_enabled, autopost_schedule, autopost_time_local, timezone, default_category')
          .eq('organization_id', organizationId).maybeSingle(),
        sb.from('social_posts').select('id, category, status, content, scheduled_at, published_at, external_post_id, error_message, created_at')
          .eq('organization_id', organizationId).eq('platform', 'facebook_page')
          .order('created_at', { ascending: false }).limit(20),
      ]);
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
    } finally { setLoading(false); }
  }, [organizationId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadAll(); } finally { setRefreshing(false); }
  }, [loadAll]);

  const handleConnect = useCallback(async () => {
    if (!organizationId) return;
    if (!connectPageId.trim() || !connectToken.trim()) {
      showAlert({ title: 'Missing info', message: 'Please provide Page ID and Page Access Token.', type: 'warning' }); return;
    }
    try {
      setConnecting(true);
      const sb = assertSupabase();
      const { data, error } = await sb.functions.invoke('social-facebook-connect', {
        body: { page_id: connectPageId.trim(), page_name: connectPageName.trim() || undefined, page_access_token: connectToken.trim() },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Failed to connect Facebook Page');
      setConnectToken('');
      showAlert({ title: 'Connected', message: 'Facebook Page connected successfully.', type: 'success' });
      await loadAll();
    } catch (e: any) {
      showAlert({ title: 'Connect failed', message: e?.message || 'Failed to connect Facebook Page', type: 'error' });
    } finally { setConnecting(false); }
  }, [organizationId, connectPageId, connectToken, connectPageName, loadAll]);

  const handleDisconnect = useCallback(async () => {
    if (!organizationId || !connection?.id) return;
    try {
      const sb = assertSupabase();
      const { error } = await sb.from('social_connections').update({ is_active: false })
        .eq('id', connection.id).eq('organization_id', organizationId);
      if (error) throw error;
      showAlert({ title: 'Disconnected', message: 'Facebook Page connection disabled.', type: 'info' });
      await loadAll();
    } catch (e: any) { showAlert({ title: 'Error', message: e?.message || 'Failed to disconnect', type: 'error' }); }
  }, [organizationId, connection?.id, loadAll]);

  const handleSaveSettings = useCallback(async () => {
    if (!organizationId) return;
    try {
      setSettingsSaving(true);
      const sb = assertSupabase();
      const payload = {
        organization_id: organizationId, enabled: agentEnabled,
        autopost_enabled: autopostEnabled, autopost_schedule: autopostSchedule,
        autopost_time_local: normalizeTimeHHMMToHHMMSS(autopostTime),
        timezone: timezone.trim() || null, default_category: defaultCategory,
        updated_by: profile?.id || null, created_by: profile?.id || null,
      };
      const { error } = await sb.from('social_agent_settings').upsert(payload as any, { onConflict: 'organization_id' });
      if (error) throw error;
      showAlert({ title: 'Saved', message: 'Social Agent settings updated.', type: 'success' });
      await loadAll();
    } catch (e: any) { showAlert({ title: 'Save failed', message: e?.message || 'Failed to save settings', type: 'error' }); }
    finally { setSettingsSaving(false); }
  }, [organizationId, agentEnabled, autopostEnabled, autopostSchedule, autopostTime, timezone, defaultCategory, profile?.id, loadAll]);

  const handleGenerate = useCallback(async () => {
    if (!organizationId) return;
    try {
      setGenerating(true);
      const sb = assertSupabase();
      const { data, error } = await sb.functions.invoke('social-agent-generate', {
        body: { category: generateCategory, context: generateContext.trim() || undefined },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Generation failed');
      showAlert({ title: 'Draft created', message: 'A new post draft has been added to your queue.', type: 'success' });
      setGenerateContext('');
      await loadAll();
    } catch (e: any) { showAlert({ title: 'Generation failed', message: e?.message || 'Failed to generate draft', type: 'error' }); }
    finally { setGenerating(false); }
  }, [organizationId, generateCategory, generateContext, loadAll]);

  const handlePublish = useCallback(async (postId: string) => {
    if (!organizationId) return;
    try {
      setPublishingPostId(postId);
      const sb = assertSupabase();
      const { data, error } = await sb.functions.invoke('social-facebook-publish', { body: { post_id: postId } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Publish failed');
      showAlert({ title: 'Published', message: 'Post published to Facebook.', type: 'success' });
      await loadAll();
    } catch (e: any) { showAlert({ title: 'Publish failed', message: e?.message || 'Failed to publish', type: 'error' }); await loadAll(); }
    finally { setPublishingPostId(null); }
  }, [organizationId, loadAll]);

  const handleDeletePost = useCallback(async (postId: string) => {
    if (!organizationId) return;
    try {
      const sb = assertSupabase();
      const { error } = await sb.from('social_posts').delete().eq('id', postId).eq('organization_id', organizationId);
      if (error) throw error;
      await loadAll();
    } catch (e: any) { showAlert({ title: 'Delete failed', message: e?.message || 'Failed to delete', type: 'error' }); }
  }, [organizationId, loadAll]);

  return {
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
  };
}
