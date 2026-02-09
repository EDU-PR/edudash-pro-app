/**
 * Application Review Screen
 * 
 * Full candidate review with AI-powered screening, SA vetting, pipeline actions.
 * Vetting/AI sections extracted to ApplicationVettingPanel.
 */

import { openWhatsApp } from '@/lib/utils/phoneUtils';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import HiringHubService from '@/lib/services/HiringHubService';
import { TeacherReputationService } from '@/lib/services/TeacherReputationService';
import AIVettingService, {
  type VettingChecklist,
  type VettingScore,
  type AIScreeningResult,
} from '@/lib/services/AIVettingService';
import { ApplicationStatus, getApplicationStatusLabel } from '@/types/hiring';
import type { ApplicationWithDetails } from '@/types/hiring';
import type { TeacherReference, TeacherRatingSummary } from '@/types/teacher-reputation';
import { useAlertModal } from '@/components/ui/AlertModal';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import ApplicationVettingPanel from '@/components/hiring/ApplicationVettingPanel';

export default function ApplicationReviewScreen() {
  const { applicationId, id } = useLocalSearchParams<{ applicationId?: string; id?: string }>();
  const resolvedId = applicationId || id;
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showAlert, AlertModalComponent } = useAlertModal();

  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<(ApplicationWithDetails & { resume_url?: string; created_at?: string }) | null>(null);
  const [updating, setUpdating] = useState(false);
  const [ratingSummary, setRatingSummary] = useState<TeacherRatingSummary | null>(null);
  const [references, setReferences] = useState<TeacherReference[]>([]);

  // AI Vetting
  const [checklist, setChecklist] = useState<VettingChecklist | null>(null);
  const [vettingScore, setVettingScore] = useState<VettingScore | null>(null);
  const [aiScreening, setAiScreening] = useState<AIScreeningResult | null>(null);
  const [aiScreeningLoading, setAiScreeningLoading] = useState(false);

  // Reject reason
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const loadApplication = useCallback(async () => {
    if (!resolvedId) return;
    try {
      setLoading(true);
      const data = await HiringHubService.getApplicationById(resolvedId);
      setApplication(data);

      const candidateProfileId = data?.candidate_profile?.id as string | undefined;
      let refs: TeacherReference[] = [];
      let summary: TeacherRatingSummary | null = null;

      if (candidateProfileId) {
        [summary, refs] = await Promise.all([
          TeacherReputationService.getRatingSummaryByCandidateProfileId(candidateProfileId),
          TeacherReputationService.getReferencesByCandidateProfileId(candidateProfileId),
        ]);
        setRatingSummary(summary);
        setReferences(refs);
      }

      if (data) {
        const cl = AIVettingService.generateVettingChecklist(data, data.candidate_profile);
        setChecklist(cl);
        if (data.candidate_profile) {
          const score = AIVettingService.calculateVettingScore(
            data.candidate_profile, cl, summary, refs, data.job_posting
          );
          setVettingScore(score);
        }
      }
    } catch (error: any) {
      showAlert({ title: 'Error', message: error.message || 'Failed to load application', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [resolvedId, showAlert]);

  useEffect(() => { loadApplication(); }, [loadApplication]);

  const handleStatusChange = useCallback(async (newStatus: ApplicationStatus, reason?: string) => {
    if (!application || !user?.id) return;
    setUpdating(true);
    try {
      await HiringHubService.updateApplicationStatus(application.id, newStatus, user.id, reason);
      setApplication({ ...application, status: newStatus });
      showAlert({ title: 'Status Updated', message: `Application moved to "${getApplicationStatusLabel(newStatus)}"`, type: 'success', icon: 'checkmark-circle' });
    } catch (error: any) {
      showAlert({ title: 'Error', message: error.message || 'Failed to update status', type: 'error' });
    } finally {
      setUpdating(false);
    }
  }, [application, user, showAlert]);

  const handleShortlist = () => {
    showAlert({
      title: 'Shortlist Candidate',
      message: `Move ${application?.candidate_name} to the shortlist?`,
      type: 'info', icon: 'star',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Shortlist', onPress: () => handleStatusChange(ApplicationStatus.SHORTLISTED) },
      ],
    });
  };

  const handleReject = () => { setShowRejectInput(true); setRejectReason(''); };

  const confirmReject = () => {
    showAlert({
      title: 'Reject Application',
      message: `Are you sure you want to reject ${application?.candidate_name}'s application?${rejectReason ? '\n\nReason: ' + rejectReason : ''}`,
      type: 'warning', icon: 'close-circle',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => { handleStatusChange(ApplicationStatus.REJECTED, rejectReason || undefined); setShowRejectInput(false); } },
      ],
    });
  };

  const handleScheduleInterview = () => {
    if (!application) return;
    router.push({ pathname: '/screens/interview-scheduler', params: { applicationId: application.id } });
  };

  const handleMakeOffer = () => {
    if (!application) return;
    router.push({ pathname: '/screens/offer-letter', params: { applicationId: application.id } });
  };

  const handleViewResume = async () => {
    if (!application?.resume_url) {
      showAlert({ title: 'No Resume', message: 'This candidate has not uploaded a resume.', type: 'info' });
      return;
    }
    try { await Linking.openURL(application.resume_url); } catch {
      showAlert({ title: 'Error', message: 'Unable to open resume.', type: 'error' });
    }
  };

  const handleRunAIScreening = async () => {
    if (!application?.candidate_profile || !application?.job_posting) return;
    setAiScreeningLoading(true);
    try {
      const result = await AIVettingService.aiScreenCandidate(
        application.candidate_profile, application.job_posting, references, ratingSummary, application.cover_letter
      );
      setAiScreening(result);
    } catch {
      showAlert({ title: 'AI Screening Error', message: 'Unable to run AI screening at this time.', type: 'error' });
    } finally {
      setAiScreeningLoading(false);
    }
  };

  const handleChecklistToggle = (itemId: string) => {
    if (!checklist) return;
    const item = checklist.items.find(i => i.id === itemId);
    if (!item) return;
    const newStatus = item.status === 'passed' ? 'pending' : 'passed';
    const updated = AIVettingService.updateChecklistItem(checklist, itemId, newStatus, user?.id);
    setChecklist(updated);
    if (application?.candidate_profile) {
      setVettingScore(AIVettingService.calculateVettingScore(
        application.candidate_profile, updated, ratingSummary, references, application.job_posting
      ));
    }
  };

  const getStatusColor = (status: ApplicationStatus) => {
    const colors: Record<string, string> = {
      new: '#3B82F6', under_review: '#F59E0B', shortlisted: '#8B5CF6',
      interview_scheduled: '#EC4899', offered: '#10B981', accepted: '#059669', rejected: '#EF4444',
    };
    return colors[status] || theme.textSecondary;
  };

  const renderStars = (rating?: number | null, size = 16) => {
    if (!rating) return null;
    const r = Math.round(rating);
    return (
      <View style={styles.starRow}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Ionicons key={i} name={i + 1 <= r ? 'star' : 'star-outline'} size={size} color={i + 1 <= r ? '#F59E0B' : '#D1D5DB'} />
        ))}
      </View>
    );
  };

  const getStatusActions = () => {
    if (!application) return [];
    switch (application.status) {
      case ApplicationStatus.NEW:
        return [
          { label: 'Start Review', icon: 'eye-outline' as const, onPress: () => handleStatusChange(ApplicationStatus.UNDER_REVIEW), color: theme.primary },
          { label: 'Reject', icon: 'close-circle-outline' as const, onPress: handleReject, color: theme.error },
        ];
      case ApplicationStatus.UNDER_REVIEW:
        return [
          { label: 'Shortlist', icon: 'star-outline' as const, onPress: handleShortlist, color: '#8B5CF6' },
          { label: 'Reject', icon: 'close-circle-outline' as const, onPress: handleReject, color: theme.error },
        ];
      case ApplicationStatus.SHORTLISTED:
        return [
          { label: 'Interview', icon: 'calendar-outline' as const, onPress: handleScheduleInterview, color: theme.primary },
          { label: 'Offer', icon: 'document-text-outline' as const, onPress: handleMakeOffer, color: '#10B981' },
          { label: 'Reject', icon: 'close-circle-outline' as const, onPress: handleReject, color: theme.error },
        ];
      case ApplicationStatus.INTERVIEW_SCHEDULED:
        return [
          { label: 'Make Offer', icon: 'document-text-outline' as const, onPress: handleMakeOffer, color: '#10B981' },
          { label: 'Reject', icon: 'close-circle-outline' as const, onPress: handleReject, color: theme.error },
        ];
      default: return [];
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading application...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!application) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.error} />
          <Text style={styles.errorText}>Application not found</Text>
          <TouchableOpacity style={styles.goBackBtn} onPress={() => router.back()}>
            <Text style={styles.goBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const actions = getStatusActions();
  const statusColor = getStatusColor(application.status);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Review Application', headerShown: false }} />
      <AlertModalComponent />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Application Review</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {/* Candidate Card */}
        <View style={styles.candidateCard}>
          <View style={styles.candidateRow}>
            <View style={[styles.avatar, { backgroundColor: statusColor }]}>
              <Text style={styles.avatarText}>{(application.candidate_name || 'U')[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.candidateName}>{application.candidate_name}</Text>
              <Text style={styles.candidateJob}>{application.job_title || application.job_posting?.title}</Text>
              <Text style={styles.candidateEmail}>{application.candidate_email}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusTextSmall, { color: statusColor }]}>
              {getApplicationStatusLabel(application.status)}
            </Text>
          </View>
        </View>

        <ApplicationVettingPanel
          theme={theme}
          vettingScore={vettingScore}
          aiScreening={aiScreening}
          aiScreeningLoading={aiScreeningLoading}
          checklist={checklist}
          onRunAIScreening={handleRunAIScreening}
          onChecklistToggle={handleChecklistToggle}
        />

        {/* Candidate Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Candidate Information</Text>
          <InfoRow icon="person-outline" label="Name" value={application.candidate_name || 'N/A'} theme={theme} />
          <InfoRow icon="mail-outline" label="Email" value={application.candidate_email} theme={theme}
            actions={<TouchableOpacity onPress={() => Linking.openURL(`mailto:${application.candidate_email}`)} style={{ padding: 4 }}>
              <Ionicons name="send" size={16} color={theme.primary} />
            </TouchableOpacity>} />
          {application.candidate_phone && (
            <InfoRow icon="call-outline" label="Phone" value={application.candidate_phone} theme={theme}
              actions={<View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${application.candidate_phone}`)} style={{ padding: 4 }}>
                  <Ionicons name="call" size={16} color={theme.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openWhatsApp(application.candidate_phone!, `Hi ${application.candidate_name || ''}, regarding your application...`)} style={{ padding: 4 }}>
                  <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                </TouchableOpacity>
              </View>} />
          )}
          <InfoRow icon="briefcase-outline" label="Experience" value={`${application.candidate_experience_years} years`} theme={theme} />
          <InfoRow icon="calendar-outline" label="Applied" value={new Date(application.created_at || application.applied_at).toLocaleDateString()} theme={theme} />
        </View>

        {/* References */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>References</Text>
            {application.candidate_profile?.id && (
              <TouchableOpacity onPress={() => router.push({ pathname: '/screens/teacher-references', params: { candidateProfileId: application.candidate_profile?.id } })}>
                <Text style={styles.linkText}>View All</Text>
              </TouchableOpacity>
            )}
          </View>
          {ratingSummary?.avg_rating ? (
            <View style={styles.ratingRow}>{renderStars(ratingSummary.avg_rating, 18)}<Text style={styles.ratingText}>{ratingSummary.avg_rating.toFixed(1)} ({ratingSummary.rating_count || 0})</Text></View>
          ) : (<Text style={styles.emptyText}>No ratings yet</Text>)}
          {references.slice(0, 2).map((ref) => (
            <View key={ref.id} style={styles.refCard}>
              <View style={styles.refHeader}><Text style={styles.refSchool}>{ref.school_name || 'School'}</Text>{renderStars(ref.rating_overall, 14)}</View>
              {ref.comment && <Text style={styles.refComment}>{ref.comment}</Text>}
            </View>
          ))}
        </View>

        {/* Cover Letter */}
        {application.cover_letter && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cover Letter</Text>
            <Text style={styles.coverText}>{application.cover_letter}</Text>
          </View>
        )}

        {/* Resume */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resume</Text>
          {application.resume_url ? (
            <TouchableOpacity style={styles.resumeBtn} onPress={handleViewResume}>
              <Ionicons name="document-text-outline" size={22} color={theme.primary} />
              <Text style={styles.resumeBtnText}>View Resume</Text>
              <Ionicons name="open-outline" size={18} color={theme.primary} />
            </TouchableOpacity>
          ) : (<Text style={styles.emptyText}>No resume uploaded</Text>)}
        </View>

        {/* Reject Reason */}
        {showRejectInput && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rejection Reason</Text>
            <TextInput style={styles.rejectInput} value={rejectReason} onChangeText={setRejectReason}
              placeholder="Reason for rejection (optional)..." placeholderTextColor={theme.textSecondary}
              multiline numberOfLines={3} textAlignVertical="top" />
            <View style={styles.rejectActions}>
              <TouchableOpacity style={[styles.rejectActionBtn, { backgroundColor: theme.surface }]} onPress={() => setShowRejectInput(false)}>
                <Text style={[styles.rejectActionText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.rejectActionBtn, { backgroundColor: theme.error }]} onPress={confirmReject}>
                <Text style={styles.rejectActionText}>Confirm Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Actions */}
        {actions.length > 0 && !showRejectInput && (
          <View style={styles.actionsContainer}>
            {actions.map((action, idx) => (
              <TouchableOpacity key={idx} style={[styles.actionBtn, { backgroundColor: action.color }]} onPress={action.onPress} disabled={updating}>
                {updating ? <EduDashSpinner color="#FFFFFF" size="small" /> : (
                  <><Ionicons name={action.icon} size={18} color="#FFFFFF" /><Text style={styles.actionBtnText}>{action.label}</Text></>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value, theme, actions }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; theme: any; actions?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 }}>
      <Ionicons name={icon} size={18} color={theme.textSecondary} />
      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, minWidth: 70 }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 14, color: theme.text }}>{value}</Text>
      {actions}
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    loadingText: { marginTop: 16, fontSize: 16, color: theme.textSecondary },
    errorText: { marginTop: 16, fontSize: 18, fontWeight: '600', color: theme.text },
    goBackBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: theme.primary, borderRadius: 8 },
    goBackText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: theme.text },
    content: { padding: 16, paddingBottom: 40 },
    candidateCard: { backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.border },
    candidateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    avatarText: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
    candidateName: { fontSize: 17, fontWeight: '700', color: theme.text },
    candidateJob: { fontSize: 14, color: theme.primary, fontWeight: '600', marginTop: 2 },
    candidateEmail: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 6 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusTextSmall: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
    section: { marginBottom: 16, backgroundColor: theme.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 12 },
    linkText: { fontSize: 13, color: theme.primary, fontWeight: '600' },
    starRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    ratingText: { fontSize: 13, fontWeight: '600', color: theme.text },
    emptyText: { fontSize: 14, color: theme.textSecondary, fontStyle: 'italic', textAlign: 'center', padding: 12 },
    refCard: { backgroundColor: theme.background, borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: theme.border },
    refHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    refSchool: { fontSize: 13, fontWeight: '700', color: theme.text },
    refComment: { fontSize: 12, color: theme.textSecondary, lineHeight: 18 },
    coverText: { fontSize: 14, lineHeight: 22, color: theme.text },
    resumeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, backgroundColor: theme.primary + '10', borderRadius: 8, borderWidth: 1, borderColor: theme.primary, gap: 8 },
    resumeBtnText: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.primary },
    rejectInput: { borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: theme.text, backgroundColor: theme.background, minHeight: 80, marginBottom: 12 },
    rejectActions: { flexDirection: 'row', gap: 12 },
    rejectActionBtn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: theme.border },
    rejectActionText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
    actionsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
    actionBtn: { flex: 1, minWidth: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 10 },
    actionBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  });
