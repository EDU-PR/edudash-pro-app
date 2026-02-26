/**
 * HomeworkDetailScreen
 *
 * Slim composition screen for the homework detail view.
 * Data fetching and state management live in useHomeworkDetail hook.
 * Upload UI and attachment display are in dedicated components.
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubPageHeader } from '@/components/SubPageHeader';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { useTheme } from '@/contexts/ThemeContext';
import { NamePracticePad } from '@/components/activities/preschool/NamePracticePad';
import { useHomeworkDetail } from '@/hooks/homework/useHomeworkDetail';
import { HomeworkAttachments } from '@/components/homework/HomeworkAttachments';
import { SubmissionUploadPanel } from '@/components/homework/SubmissionUploadPanel';

export default function HomeworkDetailScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const hw = useHomeworkDetail();
  const styles = createStyles(theme);

  if (!hw.assignmentId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SubPageHeader title="Homework" subtitle="Assignment not found" />
        <View style={styles.centerContent}>
          <Text style={[styles.errorText, { color: theme.error }]}>Missing assignment reference.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SubPageHeader
        title={hw.assignment?.title || 'Take-home details'}
        subtitle={hw.activeChild ? `${hw.activeChild.firstName} ${hw.activeChild.lastName}`.trim() : 'Assignment overview'}
        rightAction={{
          icon: 'refresh-outline',
          onPress: () => { void hw.refresh(); },
          label: 'Refresh',
        }}
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}>
        {/* Child selector */}
        {hw.children.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.childChips}>
            {hw.children.map((child: any) => {
              const selected = hw.activeChildId === child.id;
              return (
                <TouchableOpacity
                  key={child.id}
                  style={[
                    styles.childChip,
                    {
                      borderColor: selected ? theme.primary : theme.border,
                      backgroundColor: selected ? `${theme.primary}22` : theme.surface,
                    },
                  ]}
                  onPress={() => hw.setActiveChildId(child.id)}
                >
                  <Text style={{ color: selected ? theme.primary : theme.text, fontWeight: selected ? '700' : '500' }}>
                    {child.firstName || child.first_name || 'Child'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Loading / Error / Empty */}
        {hw.dashboardLoading || hw.loading ? (
          <View style={{ gap: 10 }}>
            {[1, 2, 3].map((item) => (
              <SkeletonLoader key={item} width="100%" height={100} borderRadius={14} />
            ))}
          </View>
        ) : hw.error ? (
          <View style={[styles.card, { borderColor: theme.error }]}>
            <Text style={[styles.errorText, { color: theme.error }]}>{hw.error}</Text>
          </View>
        ) : !hw.assignment ? (
          <View style={styles.centerContent}>
            <Text style={[styles.errorText, { color: theme.textSecondary }]}>This assignment is not available.</Text>
          </View>
        ) : (
          <>
            {/* Status card */}
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.summaryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Status</Text>
                  <Text style={[styles.value, { color: theme.text }]}>{hw.submission ? 'Submitted' : 'Not submitted'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Due</Text>
                  <Text style={[styles.value, { color: theme.text }]}>{hw.dueLabel}</Text>
                </View>
              </View>
              <View style={[styles.badgeRow, { marginTop: 10 }]}>
                <View style={[styles.badge, { backgroundColor: `${theme.primary}1f` }]}>
                  <Text style={[styles.badgeText, { color: theme.primary }]}>{hw.assignment.subject || 'Take-home'}</Text>
                </View>
                {hw.assignment.grade_band ? (
                  <View style={[styles.badge, { backgroundColor: `${theme.info}1f` }]}>
                    <Text style={[styles.badgeText, { color: theme.info }]}>{hw.assignment.grade_band}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Instructions card */}
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Instructions</Text>
              <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
                {hw.assignment.description || hw.assignment.instructions || 'No instructions provided.'}
              </Text>
              {hw.extension?.at_home_steps && hw.extension.at_home_steps.length > 0 && (
                <View style={{ marginTop: 12, gap: 6 }}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Worksheet companion steps</Text>
                  {hw.extension.at_home_steps.map((step, index) => (
                    <Text key={`step-${index}`} style={[styles.bodyText, { color: theme.text }]}>
                      {index + 1}. {step}
                    </Text>
                  ))}
                </View>
              )}
              {hw.extension?.parent_prompt ? (
                <View style={[styles.promptCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Text style={[styles.bodyText, { color: theme.textSecondary }]}>{hw.extension.parent_prompt}</Text>
                </View>
              ) : null}
            </View>

            {/* Attachments card */}
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Worksheet files</Text>
              <HomeworkAttachments
                theme={theme}
                attachments={hw.attachments}
                imageAttachments={hw.imageAttachments}
                resolvingAttachments={hw.resolvingAttachments}
                onOpenAttachment={hw.openAttachment}
              />
            </View>

            {/* Submission card */}
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Submit Physical Worksheet</Text>
              <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
                Upload clear photos or a PDF of the worksheet completed at home.
              </Text>
              <SubmissionUploadPanel
                theme={theme}
                submission={hw.submission}
                submissionText={hw.submissionText}
                setSubmissionText={hw.setSubmissionText}
                submissionFiles={hw.submissionFiles}
                submittedFileUrls={hw.submittedFileUrls}
                submittingWork={hw.submittingWork}
                submitError={hw.submitError}
                uploadProgress={hw.uploadProgress}
                isUploading={hw.isUploading}
                onTakePhoto={hw.handleTakePhoto}
                onPickFromGallery={hw.handlePickFromGallery}
                onPickDocument={hw.handlePickDocument}
                onRemoveSubmissionFile={hw.handleRemoveSubmissionFile}
                onSubmitWork={() => void hw.handleSubmitWork()}
                onOpenAttachment={hw.openAttachment}
              />
            </View>

            {/* Quick actions card */}
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Quick actions</Text>
              <View style={styles.actionGrid}>
                {hw.hasNamePractice && (
                  <TouchableOpacity
                    style={[styles.actionButton, { borderColor: theme.primary, backgroundColor: `${theme.primary}14` }]}
                    onPress={() => hw.setShowNamePractice((prev) => !prev)}
                  >
                    <Ionicons name="create-outline" size={18} color={theme.primary} />
                    <Text style={[styles.actionLabel, { color: theme.primary }]}>
                      {hw.showNamePractice ? 'Hide Name Practice' : 'Start Name Practice'}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, { borderColor: theme.border, backgroundColor: theme.background }]}
                  onPress={() => router.push(`/screens/ai-homework-helper?homeworkId=${hw.assignment.id}`)}
                >
                  <Ionicons name="sparkles-outline" size={18} color={theme.text} />
                  <Text style={[styles.actionLabel, { color: theme.text }]}>AI Homework Help</Text>
                </TouchableOpacity>
              </View>
              {hw.starterClips.length > 0 && (
                <View style={{ marginTop: 12, gap: 8 }}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Phonics clips</Text>
                  <View style={styles.clipWrap}>
                    {hw.starterClips.map((clip) => (
                      <TouchableOpacity
                        key={clip.id}
                        style={[
                          styles.clipButton,
                          {
                            borderColor: `${theme.primary}55`,
                            backgroundColor: hw.activeClipId === clip.id ? `${theme.primary}2b` : theme.background,
                          },
                        ]}
                        onPress={() => hw.playClip(clip.id)}
                      >
                        <Ionicons name="volume-medium" size={14} color={theme.primary} />
                        <Text style={[styles.clipText, { color: theme.text }]}>{clip.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Name practice pad */}
            {hw.showNamePractice && hw.activeChild && (
              <NamePracticePad
                studentId={hw.activeChild.id}
                preschoolId={hw.assignment.preschool_id || hw.activeChild.preschoolId}
                assignmentId={hw.assignment.id}
                childName={`${hw.activeChild.firstName} ${hw.activeChild.lastName}`.trim()}
                targetName={hw.activeChild.firstName || undefined}
              />
            )}
          </>
        )}
      </ScrollView>

      {/* Camera preview modal */}
      {hw.pendingPreview && (
        <Modal visible transparent animationType="fade">
          <View style={previewStyles.container}>
            <Image source={{ uri: hw.pendingPreview }} style={previewStyles.image} resizeMode="contain" />
            <View style={previewStyles.actions}>
              <TouchableOpacity style={previewStyles.cancelButton} onPress={() => hw.setPendingPreview(null)}>
                <Ionicons name="close" size={20} color="#fff" />
                <Text style={previewStyles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={previewStyles.retakeButton} onPress={hw.handleRetake}>
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={previewStyles.buttonText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={previewStyles.useButton}
                onPress={() => {
                  hw.addFileToUpload(hw.pendingPreview!);
                  hw.setPendingPreview(null);
                }}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={previewStyles.buttonText}>Use Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 16, gap: 12 },
    centerContent: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
    card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
    errorText: { fontSize: 14, textAlign: 'center', fontWeight: '600' },
    childChips: { gap: 8, paddingBottom: 4 },
    childChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
    summaryRow: { flexDirection: 'row', gap: 12 },
    label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
    value: { marginTop: 4, fontSize: 16, fontWeight: '700' },
    badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    badgeText: { fontSize: 12, fontWeight: '700' },
    cardTitle: { fontSize: 17, fontWeight: '700' },
    bodyText: { fontSize: 14, lineHeight: 20 },
    promptCard: { borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 6 },
    actionGrid: { gap: 8 },
    actionButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
    actionLabel: { fontSize: 14, fontWeight: '600' },
    clipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    clipButton: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 },
    clipText: { fontSize: 12, fontWeight: '600' },
  });

const previewStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: '70%' },
  actions: { flexDirection: 'row', gap: 16, marginTop: 24, paddingHorizontal: 20 },
  cancelButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: '#555' },
  retakeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: '#e67e22' },
  useButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: '#27ae60' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
