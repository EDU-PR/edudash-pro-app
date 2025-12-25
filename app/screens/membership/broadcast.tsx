/**
 * President Broadcast Screen
 * Allows President/CEO to send announcements to organization members
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { assertSupabase } from '@/lib/supabase';
import OrganizationAnnouncementService, {
  type CreateAnnouncementInput,
  type OrganizationAnnouncement,
  type TargetAudience,
  type AnnouncementPriority,
  type AnnouncementType,
} from '@/lib/services/organizationAnnouncementService';

// ============================================================================
// CONSTANTS
// ============================================================================

const TARGET_AUDIENCES: { value: TargetAudience; label: string; icon: string }[] = [
  { value: 'all', label: 'All Members', icon: 'people' },
  { value: 'regional_managers', label: 'Regional Managers', icon: 'business' },
  { value: 'branch_managers', label: 'Branch Managers', icon: 'git-branch' },
  { value: 'members', label: 'Regular Members', icon: 'person' },
];

const PRIORITIES: { value: AnnouncementPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#6B7280' },
  { value: 'normal', label: 'Normal', color: '#3B82F6' },
  { value: 'high', label: 'High', color: '#F59E0B' },
  { value: 'urgent', label: 'Urgent', color: '#EF4444' },
];

const ANNOUNCEMENT_TYPES: { value: AnnouncementType; label: string; icon: string }[] = [
  { value: 'general', label: 'General', icon: 'megaphone' },
  { value: 'policy', label: 'Policy Update', icon: 'document-text' },
  { value: 'event', label: 'Event', icon: 'calendar' },
  { value: 'financial', label: 'Financial', icon: 'cash' },
  { value: 'strategic', label: 'Strategic', icon: 'bulb' },
  { value: 'emergency', label: 'Emergency', icon: 'warning' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function BroadcastScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetAudience, setTargetAudience] = useState<TargetAudience>('all');
  const [priority, setPriority] = useState<AnnouncementPriority>('normal');
  const [announcementType, setAnnouncementType] = useState<AnnouncementType>('general');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [recentAnnouncements, setRecentAnnouncements] = useState<OrganizationAnnouncement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showComposer, setShowComposer] = useState(true);

  // Fetch organization ID
  useEffect(() => {
    const fetchOrgId = async () => {
      if (!user?.id) return;
      
      try {
        const { data: member } = await assertSupabase()
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
        
        if (member?.organization_id) {
          setOrganizationId(member.organization_id);
          loadRecentAnnouncements(member.organization_id);
        }
      } catch (error) {
        console.error('[Broadcast] Error fetching org ID:', error);
      }
    };
    
    fetchOrgId();
  }, [user?.id]);

  // Load recent announcements
  const loadRecentAnnouncements = async (orgId: string) => {
    setLoading(true);
    try {
      const result = await OrganizationAnnouncementService.getAnnouncements(orgId, {}, 10);
      if (result.success && result.data) {
        setRecentAnnouncements(result.data);
      }
    } catch (error) {
      console.error('[Broadcast] Error loading announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    if (!organizationId) return;
    setRefreshing(true);
    await loadRecentAnnouncements(organizationId);
    setRefreshing(false);
  }, [organizationId]);

  // Send announcement
  const handleSend = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an announcement title');
      return;
    }
    if (!content.trim()) {
      Alert.alert('Error', 'Please enter the announcement content');
      return;
    }
    if (!organizationId || !user?.id) {
      Alert.alert('Error', 'Unable to send announcement. Please try again.');
      return;
    }

    Alert.alert(
      'Send Announcement',
      `Send this announcement to ${TARGET_AUDIENCES.find(t => t.value === targetAudience)?.label}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setSending(true);
            try {
              const input: CreateAnnouncementInput = {
                title: title.trim(),
                content: content.trim(),
                target_audience: targetAudience,
                priority,
                announcement_type: announcementType,
              };

              const result = await OrganizationAnnouncementService.create(
                organizationId,
                user.id,
                input
              );

              if (result.success) {
                Alert.alert('Success', 'Announcement sent successfully!');
                setTitle('');
                setContent('');
                setTargetAudience('all');
                setPriority('normal');
                setAnnouncementType('general');
                loadRecentAnnouncements(organizationId);
                setShowComposer(false);
              } else {
                Alert.alert('Error', result.error || 'Failed to send announcement');
              }
            } catch (error) {
              console.error('[Broadcast] Send error:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  // Delete announcement
  const handleDelete = (announcementId: string) => {
    Alert.alert(
      'Delete Announcement',
      'Are you sure you want to delete this announcement?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await OrganizationAnnouncementService.delete(announcementId);
            if (result.success && organizationId) {
              loadRecentAnnouncements(organizationId);
            } else {
              Alert.alert('Error', result.error || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const getPriorityColor = (p: AnnouncementPriority) => {
    return PRIORITIES.find(pr => pr.value === p)?.color || theme.textSecondary;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Broadcast</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Send announcements to your organization
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.newButton, { backgroundColor: theme.primary }]}
          onPress={() => setShowComposer(!showComposer)}
        >
          <Ionicons name={showComposer ? 'close' : 'add'} size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* Composer */}
        {showComposer && (
          <Card margin={0} style={styles.composerCard}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>New Announcement</Text>

            {/* Title Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Title</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                value={title}
                onChangeText={setTitle}
                placeholder="Announcement title..."
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            {/* Content Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Message</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                value={content}
                onChangeText={setContent}
                placeholder="Write your announcement..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Target Audience */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Target Audience</Text>
              <View style={styles.optionsRow}>
                {TARGET_AUDIENCES.map((audience) => (
                  <TouchableOpacity
                    key={audience.value}
                    style={[
                      styles.optionButton,
                      { borderColor: theme.border },
                      targetAudience === audience.value && { backgroundColor: theme.primary + '20', borderColor: theme.primary },
                    ]}
                    onPress={() => setTargetAudience(audience.value)}
                  >
                    <Ionicons
                      name={audience.icon as any}
                      size={16}
                      color={targetAudience === audience.value ? theme.primary : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.optionLabel,
                        { color: targetAudience === audience.value ? theme.primary : theme.textSecondary },
                      ]}
                    >
                      {audience.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Priority */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Priority</Text>
              <View style={styles.priorityRow}>
                {PRIORITIES.map((p) => (
                  <TouchableOpacity
                    key={p.value}
                    style={[
                      styles.priorityButton,
                      { borderColor: theme.border },
                      priority === p.value && { backgroundColor: p.color + '20', borderColor: p.color },
                    ]}
                    onPress={() => setPriority(p.value)}
                  >
                    <View style={[styles.priorityDot, { backgroundColor: p.color }]} />
                    <Text
                      style={[
                        styles.priorityLabel,
                        { color: priority === p.value ? p.color : theme.textSecondary },
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Announcement Type */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.typeRow}>
                  {ANNOUNCEMENT_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.typeButton,
                        { borderColor: theme.border },
                        announcementType === type.value && { backgroundColor: theme.primary + '20', borderColor: theme.primary },
                      ]}
                      onPress={() => setAnnouncementType(type.value)}
                    >
                      <Ionicons
                        name={type.icon as any}
                        size={16}
                        color={announcementType === type.value ? theme.primary : theme.textSecondary}
                      />
                      <Text
                        style={[
                          styles.typeLabel,
                          { color: announcementType === type.value ? theme.primary : theme.textSecondary },
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Send Button */}
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: theme.primary }]}
              onPress={handleSend}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={styles.sendButtonText}>Send Announcement</Text>
                </>
              )}
            </TouchableOpacity>
          </Card>
        )}

        {/* Recent Announcements */}
        <View style={styles.recentSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Announcements</Text>
          
          {loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
          ) : recentAnnouncements.length === 0 ? (
            <Card margin={0}>
              <View style={styles.emptyState}>
                <Ionicons name="megaphone-outline" size={48} color={theme.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No announcements yet
                </Text>
                <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                  Create your first announcement above
                </Text>
              </View>
            </Card>
          ) : (
            recentAnnouncements.map((announcement) => (
              <Card key={announcement.id} margin={0} style={styles.announcementCard}>
                <View style={styles.announcementHeader}>
                  <View style={styles.announcementMeta}>
                    <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(announcement.priority) + '20' }]}>
                      <Text style={[styles.priorityBadgeText, { color: getPriorityColor(announcement.priority) }]}>
                        {announcement.priority.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.announcementDate, { color: theme.textSecondary }]}>
                      {formatDate(announcement.published_at || announcement.created_at)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(announcement.id)}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.announcementTitle, { color: theme.text }]}>
                  {announcement.title}
                </Text>
                <Text style={[styles.announcementContent, { color: theme.textSecondary }]} numberOfLines={3}>
                  {announcement.content}
                </Text>
                <View style={styles.announcementFooter}>
                  <View style={styles.audienceTag}>
                    <Ionicons
                      name={TARGET_AUDIENCES.find(t => t.value === announcement.target_audience)?.icon as any || 'people'}
                      size={14}
                      color={theme.textSecondary}
                    />
                    <Text style={[styles.audienceTagText, { color: theme.textSecondary }]}>
                      {TARGET_AUDIENCES.find(t => t.value === announcement.target_audience)?.label || announcement.target_audience}
                    </Text>
                  </View>
                  <Text style={[styles.readCount, { color: theme.textSecondary }]}>
                    {announcement.read_by?.length || 0} read
                  </Text>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
  },
  newButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  composerCard: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 20,
    gap: 6,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
    gap: 6,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 20,
    gap: 6,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  recentSection: {
    marginTop: 8,
  },
  loader: {
    marginTop: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  announcementCard: {
    marginBottom: 12,
  },
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  announcementMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  announcementDate: {
    fontSize: 12,
  },
  announcementTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  announcementContent: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  announcementFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  audienceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  audienceTagText: {
    fontSize: 12,
  },
  readCount: {
    fontSize: 12,
  },
});
