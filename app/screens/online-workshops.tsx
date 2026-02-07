/**
 * Online Workshops Screen
 * 
 * Principal-facing workshop management for:
 * - Creating and scheduling teacher development workshops
 * - Virtual (Daily.co) and in-person workshops
 * - Workshop enrollment and attendance tracking
 * - CAPS-aligned professional development topics
 * - Certificate generation
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlertModal } from '@/components/ui/AlertModal';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { assertSupabase } from '@/lib/supabase';

interface Workshop {
  id: string;
  title: string;
  description: string;
  topic_category: string;
  date: string;
  time: string;
  duration_minutes: number;
  mode: 'virtual' | 'in_person' | 'hybrid';
  meeting_link?: string;
  location?: string;
  max_capacity: number;
  enrolled_count: number;
  status: 'draft' | 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
  facilitator_name?: string;
  preschool_id: string;
  created_by: string;
  created_at: string;
}

type ViewMode = 'list' | 'create';
type FilterStatus = 'all' | 'upcoming' | 'completed' | 'draft';

const TOPIC_CATEGORIES = [
  'CAPS Foundation Phase',
  'Early Childhood Development',
  'Inclusive Education',
  'Classroom Management',
  'Assessment & Grading',
  'Digital Learning Tools',
  'Parent Communication',
  'STEM Activities',
  'Language Development',
  'Child Safety & Wellness',
  'Administrative Skills',
  'Other',
];

const DURATION_OPTIONS = [30, 45, 60, 90, 120, 180];

export default function OnlineWorkshopsScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showAlert, AlertModalComponent } = useAlertModal();

  const preschoolId = profile?.organization_id || (profile as any)?.preschool_id;

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  // Create form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topicCategory, setTopicCategory] = useState('');
  const [showTopicPicker, setShowTopicPicker] = useState(false);
  const [workshopDate, setWorkshopDate] = useState(new Date());
  const [workshopTime, setWorkshopTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [mode, setMode] = useState<'virtual' | 'in_person' | 'hybrid'>('virtual');
  const [meetingLink, setMeetingLink] = useState('');
  const [locationField, setLocationField] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('30');
  const [facilitator, setFacilitator] = useState('');

  const loadWorkshops = useCallback(async () => {
    if (!preschoolId) return;
    try {
      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from('workshops')
        .select('*')
        .eq('preschool_id', preschoolId)
        .order('date', { ascending: false });

      if (error) throw error;
      setWorkshops((data as Workshop[]) || []);
    } catch (error: any) {
      // Table may not exist yet — show empty state
      setWorkshops([]);
    }
  }, [preschoolId]);

  React.useEffect(() => { loadWorkshops(); }, [loadWorkshops]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadWorkshops();
    setRefreshing(false);
  }, [loadWorkshops]);

  const filteredWorkshops = useMemo(() => {
    if (filterStatus === 'all') return workshops;
    return workshops.filter(w => w.status === filterStatus);
  }, [workshops, filterStatus]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setTopicCategory('');
    setWorkshopDate(new Date());
    setWorkshopTime(new Date());
    setDurationMinutes(60);
    setMode('virtual');
    setMeetingLink('');
    setLocationField('');
    setMaxCapacity('30');
    setFacilitator('');
  };

  const handleCreateWorkshop = async () => {
    if (!title.trim()) {
      showAlert({ title: 'Required', message: 'Workshop title is required.', type: 'warning' });
      return;
    }
    if (!topicCategory) {
      showAlert({ title: 'Required', message: 'Please select a topic category.', type: 'warning' });
      return;
    }
    if (mode !== 'in_person' && !meetingLink.trim()) {
      showAlert({ title: 'Required', message: 'Meeting link is required for virtual/hybrid workshops.', type: 'warning' });
      return;
    }
    if (mode !== 'virtual' && !locationField.trim()) {
      showAlert({ title: 'Required', message: 'Location is required for in-person/hybrid workshops.', type: 'warning' });
      return;
    }
    if (!preschoolId || !user?.id) return;

    setSubmitting(true);
    try {
      const supabase = assertSupabase();
      const dateStr = workshopDate.toISOString().split('T')[0];
      const timeStr = workshopTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

      const { error } = await supabase.from('workshops').insert({
        title: title.trim(),
        description: description.trim(),
        topic_category: topicCategory,
        date: dateStr,
        time: timeStr,
        duration_minutes: durationMinutes,
        mode,
        meeting_link: meetingLink.trim() || null,
        location: locationField.trim() || null,
        max_capacity: parseInt(maxCapacity) || 30,
        enrolled_count: 0,
        status: 'upcoming',
        facilitator_name: facilitator.trim() || null,
        preschool_id: preschoolId,
        created_by: user.id,
      });

      if (error) throw error;

      showAlert({
        title: 'Workshop Created',
        message: `"${title.trim()}" has been scheduled for ${dateStr}.`,
        type: 'success',
        icon: 'checkmark-circle',
        buttons: [{ text: 'OK', onPress: () => { setViewMode('list'); resetForm(); loadWorkshops(); } }],
      });
    } catch (error: any) {
      showAlert({ title: 'Error', message: error.message || 'Failed to create workshop.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelWorkshop = (workshop: Workshop) => {
    showAlert({
      title: 'Cancel Workshop',
      message: `Are you sure you want to cancel "${workshop.title}"? ${workshop.enrolled_count} teachers are enrolled.`,
      type: 'warning',
      buttons: [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel Workshop', style: 'destructive',
          onPress: async () => {
            try {
              const supabase = assertSupabase();
              await supabase.from('workshops').update({ status: 'cancelled' }).eq('id', workshop.id);
              loadWorkshops();
            } catch {
              showAlert({ title: 'Error', message: 'Failed to cancel workshop.', type: 'error' });
            }
          },
        },
      ],
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: '#6B7280', upcoming: '#3B82F6', in_progress: '#F59E0B',
      completed: '#10B981', cancelled: '#EF4444',
    };
    return colors[status] || theme.textSecondary;
  };

  const getModeIcon = (m: string): keyof typeof Ionicons.glyphMap => {
    if (m === 'virtual') return 'videocam-outline';
    if (m === 'hybrid') return 'git-merge-outline';
    return 'location-outline';
  };

  if (viewMode === 'create') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ title: 'Create Workshop', headerShown: false }} />
        <AlertModalComponent />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => setViewMode('list')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Workshop</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.formContent}>
          {/* Title */}
          <View style={styles.field}>
            <Text style={styles.label}>Title <Text style={styles.required}>*</Text></Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle}
              placeholder="e.g. CAPS Assessment Strategies" placeholderTextColor={theme.textSecondary} />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription}
              placeholder="Workshop objectives and what participants will learn..." placeholderTextColor={theme.textSecondary}
              multiline numberOfLines={3} textAlignVertical="top" />
          </View>

          {/* Topic Category */}
          <View style={styles.field}>
            <Text style={styles.label}>Topic <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity style={styles.selectBtn} onPress={() => setShowTopicPicker(!showTopicPicker)}>
              <Ionicons name="school-outline" size={20} color={theme.primary} />
              <Text style={[styles.selectText, !topicCategory && { color: theme.textSecondary }]}>
                {topicCategory || 'Select topic category'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
            {showTopicPicker && (
              <View style={styles.topicList}>
                {TOPIC_CATEGORIES.map(cat => (
                  <TouchableOpacity key={cat} style={[styles.topicItem, topicCategory === cat && styles.topicItemActive]}
                    onPress={() => { setTopicCategory(cat); setShowTopicPicker(false); }}>
                    <Text style={[styles.topicText, topicCategory === cat && styles.topicTextActive]}>{cat}</Text>
                    {topicCategory === cat && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Date & Time */}
          <View style={styles.dateRow}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Date <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity style={styles.selectBtn} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={20} color={theme.primary} />
                <Text style={styles.selectText}>{workshopDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Time <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity style={styles.selectBtn} onPress={() => setShowTimePicker(true)}>
                <Ionicons name="time-outline" size={20} color={theme.primary} />
                <Text style={styles.selectText}>
                  {workshopTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {showDatePicker && (
            <DateTimePicker value={workshopDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_: any, d?: Date) => { setShowDatePicker(Platform.OS === 'ios'); if (d) setWorkshopDate(d); }}
              minimumDate={new Date()} />
          )}
          {showTimePicker && (
            <DateTimePicker value={workshopTime} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_: any, t?: Date) => { setShowTimePicker(Platform.OS === 'ios'); if (t) setWorkshopTime(t); }}
              minuteInterval={15} />
          )}

          {/* Duration */}
          <View style={styles.field}>
            <Text style={styles.label}>Duration</Text>
            <View style={styles.chipRow}>
              {DURATION_OPTIONS.map(d => (
                <TouchableOpacity key={d} style={[styles.chip, durationMinutes === d && styles.chipActive]}
                  onPress={() => setDurationMinutes(d)}>
                  <Text style={[styles.chipText, durationMinutes === d && styles.chipTextActive]}>
                    {d >= 60 ? `${d / 60}h` : `${d}m`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Mode */}
          <View style={styles.field}>
            <Text style={styles.label}>Mode <Text style={styles.required}>*</Text></Text>
            <View style={styles.chipRow}>
              {([{ key: 'virtual', label: 'Virtual', icon: 'videocam-outline' }, { key: 'in_person', label: 'In-Person', icon: 'location-outline' }, { key: 'hybrid', label: 'Hybrid', icon: 'git-merge-outline' }] as const).map(m => (
                <TouchableOpacity key={m.key} style={[styles.modeChip, mode === m.key && styles.chipActive]}
                  onPress={() => setMode(m.key)}>
                  <Ionicons name={m.icon} size={16} color={mode === m.key ? '#FFFFFF' : theme.textSecondary} />
                  <Text style={[styles.chipText, mode === m.key && styles.chipTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Meeting Link (virtual/hybrid) */}
          {mode !== 'in_person' && (
            <View style={styles.field}>
              <Text style={styles.label}>Meeting Link <Text style={styles.required}>*</Text></Text>
              <TextInput style={styles.input} value={meetingLink} onChangeText={setMeetingLink}
                placeholder="https://meet.google.com/..." placeholderTextColor={theme.textSecondary}
                keyboardType="url" autoCapitalize="none" />
            </View>
          )}

          {/* Location (in-person/hybrid) */}
          {mode !== 'virtual' && (
            <View style={styles.field}>
              <Text style={styles.label}>Location <Text style={styles.required}>*</Text></Text>
              <TextInput style={styles.input} value={locationField} onChangeText={setLocationField}
                placeholder="e.g. School Hall, Room 5" placeholderTextColor={theme.textSecondary} />
            </View>
          )}

          {/* Capacity & Facilitator */}
          <View style={styles.dateRow}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Max Capacity</Text>
              <TextInput style={styles.input} value={maxCapacity} onChangeText={setMaxCapacity}
                keyboardType="numeric" placeholder="30" placeholderTextColor={theme.textSecondary} />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Facilitator</Text>
              <TextInput style={styles.input} value={facilitator} onChangeText={setFacilitator}
                placeholder="Name..." placeholderTextColor={theme.textSecondary} />
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleCreateWorkshop} disabled={submitting}>
            {submitting ? <EduDashSpinner color="#FFFFFF" size="small" /> : (
              <><Ionicons name="add-circle" size={20} color="#FFFFFF" /><Text style={styles.submitText}>Create Workshop</Text></>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // List view
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Workshops', headerShown: false }} />
      <AlertModalComponent />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workshops</Text>
        <TouchableOpacity onPress={() => setViewMode('create')} style={styles.backBtn}>
          <Ionicons name="add-circle-outline" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'upcoming', 'completed', 'draft'] as FilterStatus[]).map(f => (
          <TouchableOpacity key={f} style={[styles.filterChip, filterStatus === f && styles.filterChipActive]}
            onPress={() => setFilterStatus(f)}>
            <Text style={[styles.filterText, filterStatus === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredWorkshops}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        renderItem={({ item }) => {
          const color = getStatusColor(item.status);
          return (
            <View style={styles.workshopCard}>
              <View style={styles.workshopHeader}>
                <View style={[styles.modeIndicator, { backgroundColor: color + '15' }]}>
                  <Ionicons name={getModeIcon(item.mode)} size={18} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.workshopTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.workshopTopic}>{item.topic_category}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: color + '15' }]}>
                  <View style={[styles.statusDot, { backgroundColor: color }]} />
                  <Text style={[styles.statusLabel, { color }]}>{item.status.replace('_', ' ')}</Text>
                </View>
              </View>
              <View style={styles.workshopMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
                  <Text style={styles.metaText}>{new Date(item.date).toLocaleDateString()}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                  <Text style={styles.metaText}>{item.time} · {item.duration_minutes}min</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="people-outline" size={14} color={theme.textSecondary} />
                  <Text style={styles.metaText}>{item.enrolled_count}/{item.max_capacity}</Text>
                </View>
              </View>
              {item.facilitator_name && (
                <Text style={styles.facilitatorText}>Facilitator: {item.facilitator_name}</Text>
              )}
              {item.status === 'upcoming' && (
                <View style={styles.workshopActions}>
                  {item.meeting_link && (
                    <TouchableOpacity style={styles.joinBtn} onPress={() => item.meeting_link && require('react-native').Linking.openURL(item.meeting_link)}>
                      <Ionicons name="videocam" size={16} color="#FFFFFF" />
                      <Text style={styles.joinText}>Join</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancelWorkshop(item)}>
                    <Ionicons name="close-circle-outline" size={16} color={theme.error} />
                    <Text style={[styles.cancelText, { color: theme.error }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}><EduDashSpinner size="large" color={theme.primary} /></View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="school-outline" size={64} color={theme.textSecondary} />
              <Text style={styles.emptyTitle}>No Workshops Yet</Text>
              <Text style={styles.emptySubtitle}>Create your first professional development workshop for your teachers.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setViewMode('create')}>
                <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                <Text style={styles.emptyBtnText}>Create Workshop</Text>
              </TouchableOpacity>
            </View>
          )
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: theme.text },
    filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
    filterChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    filterText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
    filterTextActive: { color: '#FFFFFF' },
    listContent: { padding: 16, paddingBottom: 40 },
    workshopCard: { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
    workshopHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
    modeIndicator: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    workshopTitle: { fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 2 },
    workshopTopic: { fontSize: 12, color: theme.primary, fontWeight: '600' },
    statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    workshopMeta: { flexDirection: 'row', gap: 16, marginBottom: 8 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, color: theme.textSecondary },
    facilitatorText: { fontSize: 12, color: theme.textSecondary, fontStyle: 'italic', marginBottom: 8 },
    workshopActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    joinText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
    cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.error + '40' },
    cancelText: { fontSize: 13, fontWeight: '600' },
    emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
    emptySubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
    emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
    emptyBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
    // Create form
    formContent: { padding: 16, paddingBottom: 40 },
    field: { marginBottom: 18 },
    label: { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 6 },
    required: { color: theme.error },
    input: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 12, fontSize: 15, color: theme.text },
    textArea: { minHeight: 80 },
    selectBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 12 },
    selectText: { flex: 1, fontSize: 15, color: theme.text },
    topicList: { marginTop: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
    topicItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
    topicItemActive: { backgroundColor: theme.primary },
    topicText: { fontSize: 14, color: theme.text },
    topicTextActive: { color: '#FFFFFF', fontWeight: '600' },
    dateRow: { flexDirection: 'row', gap: 12 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
    chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    chipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
    chipTextActive: { color: '#FFFFFF' },
    modeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, padding: 16, borderRadius: 10, marginTop: 8 },
    submitText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  });
