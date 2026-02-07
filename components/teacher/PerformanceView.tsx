/**
 * PerformanceView
 *
 * Teacher performance reviews for principals.
 * Reads/writes teacher_performance_reviews table.
 * ≤400 lines per WARP.md.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import type { Teacher } from '@/types/teacher-management';
import type { AlertButton } from '@/components/ui/AlertModal';

interface PerformanceReview {
  id: string;
  teacher_id: string;
  reviewer_id: string;
  rating: number;
  review_date: string;
  strengths: string[];
  improvement_areas: string[];
  goals: string[];
  notes: string | null;
}

interface PerformanceViewProps {
  teachers: Teacher[];
  preschoolId: string | null;
  userId?: string;
  theme?: ThemeColors;
  showAlert: (cfg: {
    title: string;
    message?: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    buttons?: AlertButton[];
  }) => void;
}

export function PerformanceView({ teachers, preschoolId, userId, theme, showAlert }: PerformanceViewProps) {
  const [reviews, setReviews] = useState<Record<string, PerformanceReview[]>>({});
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [newRating, setNewRating] = useState(4);
  const [newStrengths, setNewStrengths] = useState('');
  const [newImprovements, setNewImprovements] = useState('');
  const [newGoals, setNewGoals] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const fetchReviews = useCallback(async () => {
    if (!preschoolId) return;
    try {
      setLoading(true);
      const { data, error } = await assertSupabase()
        .from('teacher_performance_reviews')
        .select('*')
        .eq('preschool_id', preschoolId)
        .order('review_date', { ascending: false });
      if (error) throw error;
      const grouped: Record<string, PerformanceReview[]> = {};
      (data || []).forEach((r: PerformanceReview) => {
        if (!grouped[r.teacher_id]) grouped[r.teacher_id] = [];
        grouped[r.teacher_id].push(r);
      });
      setReviews(grouped);
    } catch (err) {
      console.error('[PerformanceView] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [preschoolId]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const resetForm = () => { setNewRating(4); setNewStrengths(''); setNewImprovements(''); setNewGoals(''); setNewNotes(''); setSelectedTeacherId(null); };

  const handleAddReview = useCallback(async () => {
    if (!selectedTeacherId || !preschoolId || !userId) return;
    try {
      setSaving(true);
      const { error } = await assertSupabase()
        .from('teacher_performance_reviews')
        .insert({
          teacher_id: selectedTeacherId,
          preschool_id: preschoolId,
          reviewer_id: userId,
          rating: newRating,
          review_date: new Date().toISOString().split('T')[0],
          strengths: newStrengths.split(',').map(s => s.trim()).filter(Boolean),
          improvement_areas: newImprovements.split(',').map(s => s.trim()).filter(Boolean),
          goals: newGoals.split(',').map(s => s.trim()).filter(Boolean),
          notes: newNotes || null,
        });
      if (error) throw error;
      setShowAddModal(false);
      resetForm();
      await fetchReviews();
      showAlert({ title: 'Review Saved', message: 'Performance review recorded.', type: 'success' });
    } catch (err) {
      console.error('[PerformanceView] save error:', err);
      showAlert({ title: 'Error', message: 'Failed to save review.', type: 'error' });
    } finally { setSaving(false); }
  }, [selectedTeacherId, preschoolId, userId, newRating, newStrengths, newImprovements, newGoals, newNotes, fetchReviews, showAlert]);

  const getAvgRating = (tid: string): number | null => {
    const r = reviews[tid];
    if (!r?.length) return null;
    return parseFloat((r.reduce((s, x) => s + Number(x.rating), 0) / r.length).toFixed(1));
  };

  const renderStars = (rating: number, interactive = false) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} disabled={!interactive} onPress={() => interactive && setNewRating(star)}>
          <Ionicons name={star <= rating ? 'star' : 'star-outline'} size={interactive ? 28 : 16} color={star <= rating ? '#F59E0B' : '#6b7280'} />
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderTeacher = ({ item: t }: { item: Teacher }) => {
    const tReviews = reviews[t.id] || [];
    const avg = getAvgRating(t.id);
    const latest = tReviews[0];
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.teacherName}>{t.firstName} {t.lastName}</Text>
            <Text style={styles.teacherEmail}>{t.email}</Text>
          </View>
          <View style={styles.ratingBadge}>
            {avg !== null ? (<><Ionicons name="star" size={14} color="#F59E0B" /><Text style={styles.ratingValue}>{avg}</Text><Text style={styles.ratingCount}>({tReviews.length})</Text></>) : (<Text style={styles.noRating}>No reviews</Text>)}
          </View>
        </View>
        {latest ? (
          <View style={styles.reviewSection}>
            <View style={styles.reviewHeader}><Text style={styles.reviewLabel}>Latest Review</Text><Text style={styles.reviewDate}>{new Date(latest.review_date).toLocaleDateString()}</Text></View>
            {renderStars(Number(latest.rating))}
            {latest.strengths.length > 0 ? (<View style={styles.tagRow}><Ionicons name="checkmark-circle" size={14} color="#10B981" /><Text style={styles.tagLabel}>{latest.strengths.join(', ')}</Text></View>) : null}
            {latest.improvement_areas.length > 0 ? (<View style={styles.tagRow}><Ionicons name="arrow-up-circle" size={14} color="#F59E0B" /><Text style={styles.tagLabel}>{latest.improvement_areas.join(', ')}</Text></View>) : null}
            {latest.notes ? <Text style={styles.notesText} numberOfLines={2}>{latest.notes}</Text> : null}
          </View>
        ) : null}
        <TouchableOpacity style={styles.addReviewBtn} onPress={() => { setSelectedTeacherId(t.id); setShowAddModal(true); }}>
          <Ionicons name="add-circle-outline" size={18} color="#4F46E5" />
          <Text style={styles.addReviewText}>Add Review</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Performance Reviews</Text><Text style={styles.sectionSubtitle}>{teachers.length} teachers</Text></View>
      <FlatList data={teachers} keyExtractor={(t) => t.id} renderItem={renderTeacher} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchReviews} />}
        ListEmptyComponent={<View style={styles.emptyContainer}><Ionicons name="analytics-outline" size={48} color={theme?.textSecondary || '#9ca3af'} /><Text style={styles.emptyTitle}>No Teachers</Text><Text style={styles.emptyText}>Add teachers to start tracking performance.</Text></View>} />
      {/* Add Review Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>New Performance Review</Text><TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }}><Ionicons name="close" size={24} color={theme?.text || '#f1f5f9'} /></TouchableOpacity></View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Rating</Text>
              {renderStars(newRating, true)}
              <Text style={styles.inputLabel}>Strengths (comma separated)</Text>
              <TextInput style={styles.input} value={newStrengths} onChangeText={setNewStrengths} placeholder="e.g. Creative, Patient, Organized" placeholderTextColor={theme?.textSecondary || '#6b7280'} multiline />
              <Text style={styles.inputLabel}>Areas for Improvement (comma separated)</Text>
              <TextInput style={styles.input} value={newImprovements} onChangeText={setNewImprovements} placeholder="e.g. Time management, Communication" placeholderTextColor={theme?.textSecondary || '#6b7280'} multiline />
              <Text style={styles.inputLabel}>Goals (comma separated)</Text>
              <TextInput style={styles.input} value={newGoals} onChangeText={setNewGoals} placeholder="e.g. Complete CAPS training, Improve reading scores" placeholderTextColor={theme?.textSecondary || '#6b7280'} multiline />
              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput style={[styles.input, { minHeight: 80 }]} value={newNotes} onChangeText={setNewNotes} placeholder="Additional observations..." placeholderTextColor={theme?.textSecondary || '#6b7280'} multiline />
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleAddReview} disabled={saving}><Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Review'}</Text></TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme?: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 16 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: theme?.text || '#111827' },
    sectionSubtitle: { fontSize: 14, color: theme?.textSecondary || '#6b7280' },
    listContent: { paddingBottom: 24 },
    card: { backgroundColor: theme?.cardBackground || '#1e293b', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme?.border || '#334155' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    teacherName: { fontSize: 16, fontWeight: '700', color: theme?.text || '#f1f5f9' },
    teacherEmail: { fontSize: 13, color: theme?.textSecondary || '#94a3b8', marginTop: 2 },
    ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: (theme?.surface || '#0f172a') + '80', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
    ratingValue: { fontSize: 14, fontWeight: '700', color: '#F59E0B' },
    ratingCount: { fontSize: 11, color: theme?.textSecondary || '#94a3b8' },
    noRating: { fontSize: 12, color: theme?.textSecondary || '#94a3b8' },
    reviewSection: { backgroundColor: (theme?.surface || '#0f172a') + '60', borderRadius: 10, padding: 12, marginBottom: 10 },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    reviewLabel: { fontSize: 12, fontWeight: '600', color: theme?.textSecondary || '#94a3b8' },
    reviewDate: { fontSize: 11, color: theme?.textSecondary || '#6b7280' },
    starsRow: { flexDirection: 'row', gap: 4, marginBottom: 8 },
    tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    tagLabel: { fontSize: 12, color: theme?.text || '#e2e8f0', flex: 1 },
    notesText: { fontSize: 12, color: theme?.textSecondary || '#94a3b8', fontStyle: 'italic', marginTop: 6 },
    addReviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme?.border || '#334155' },
    addReviewText: { fontSize: 14, fontWeight: '600', color: '#4F46E5' },
    emptyContainer: { alignItems: 'center', paddingTop: 60, gap: 8 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: theme?.text || '#f1f5f9' },
    emptyText: { fontSize: 13, color: theme?.textSecondary || '#94a3b8', textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: theme?.cardBackground || '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: theme?.border || '#334155' },
    modalTitle: { fontSize: 18, fontWeight: '700', color: theme?.text || '#f1f5f9' },
    modalBody: { padding: 20 },
    inputLabel: { fontSize: 13, fontWeight: '600', color: theme?.text || '#e2e8f0', marginBottom: 6, marginTop: 12 },
    input: { backgroundColor: theme?.inputBackground || '#0f172a', borderWidth: 1, borderColor: theme?.inputBorder || '#334155', borderRadius: 10, padding: 12, fontSize: 14, color: theme?.inputText || '#f1f5f9', minHeight: 44 },
    saveBtn: { backgroundColor: '#4F46E5', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20, marginBottom: 40 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });

export default PerformanceView;
