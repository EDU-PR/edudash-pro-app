import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubPageHeader } from '@/components/SubPageHeader';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { useParentDashboard } from '@/hooks/useDashboardData';
import { NamePracticePad } from '@/components/activities/preschool/NamePracticePad';
import { usePhonicsClips } from '@/hooks/usePhonicsClips';
import { ensureImageLibraryPermission } from '@/lib/utils/mediaLibrary';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

interface TakeHomeExtension {
  worksheet_type?: string;
  age_band?: string;
  at_home_steps?: string[];
  repetition_plan?: {
    weather_daily?: boolean;
    weekdays?: Record<string, boolean>;
  };
  parent_prompt?: string;
  name_practice?: {
    enabled?: boolean;
    mode?: string;
  };
}

interface AttachmentItem {
  url: string;
  isImage: boolean;
}

interface SubmissionUploadFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

function extractStoragePathFromUrl(url: string, bucket = 'homework-files'): string | null {
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return url.replace(/^\/+/, '');

  try {
    const parsed = new URL(url);
    const patterns = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/object/authenticated/${bucket}/`,
    ];

    for (const pattern of patterns) {
      const idx = parsed.pathname.indexOf(pattern);
      if (idx >= 0) {
        const path = parsed.pathname.slice(idx + pattern.length);
        return decodeURIComponent(path.replace(/^\/+/, ''));
      }
    }
  } catch {
    // no-op
  }

  return null;
}

function isImageUrl(url: string): boolean {
  const clean = url.split('?')[0].toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'].some((ext) => clean.endsWith(ext));
}

function sanitizeFileName(name: string): string {
  return String(name || 'file')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 100) || `file_${Date.now()}`;
}

function resolveMimeTypeFromName(name: string): string {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'Not submitted';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not submitted';
  return date.toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDueLabel(input?: string | null): string {
  if (!input) return 'No due date';
  const due = new Date(input);
  if (Number.isNaN(due.getTime())) return 'No due date';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(due);
  dueDate.setHours(0, 0, 0, 0);

  const diff = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `Overdue by ${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'}`;
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  return `Due in ${diff} days`;
}

export default function HomeworkDetailScreen() {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const supabase = assertSupabase();
  const params = useLocalSearchParams<{ assignmentId?: string; homeworkId?: string; studentId?: string }>();

  const assignmentId = useMemo(
    () => String(params.assignmentId || params.homeworkId || '').trim(),
    [params.assignmentId, params.homeworkId],
  );

  const preferredStudentId = useMemo(
    () => String(params.studentId || '').trim() || null,
    [params.studentId],
  );

  const { data: dashboardData, loading: dashboardLoading, refresh } = useParentDashboard();
  const children = dashboardData?.children || [];

  const [activeChildId, setActiveChildId] = useState<string | null>(preferredStudentId);
  const [assignment, setAssignment] = useState<any | null>(null);
  const [target, setTarget] = useState<any | null>(null);
  const [submission, setSubmission] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNamePractice, setShowNamePractice] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [resolvingAttachments, setResolvingAttachments] = useState(false);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionFiles, setSubmissionFiles] = useState<SubmissionUploadFile[]>([]);
  const [submittingWork, setSubmittingWork] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const { clips, activeClipId, playClip } = usePhonicsClips();
  const starterClips = useMemo(() => clips.slice(0, 6), [clips]);

  useEffect(() => {
    if (activeChildId) return;
    if (preferredStudentId && children.some((child: any) => child.id === preferredStudentId)) {
      setActiveChildId(preferredStudentId);
      return;
    }
    if (children[0]?.id) {
      setActiveChildId(children[0].id);
    }
  }, [activeChildId, children, preferredStudentId]);

  useEffect(() => {
    if (!assignmentId || !activeChildId) return;

    let isMounted = true;

    const loadDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        const [assignmentRes, targetRes, submissionRes] = await Promise.all([
          supabase
            .from('homework_assignments')
            .select('*')
            .eq('id', assignmentId)
            .eq('is_published', true)
            .single(),
          supabase
            .from('homework_assignment_targets')
            .select('*')
            .eq('assignment_id', assignmentId)
            .eq('student_id', activeChildId)
            .maybeSingle(),
          supabase
            .from('homework_submissions')
            .select('*')
            .eq('assignment_id', assignmentId)
            .eq('student_id', activeChildId)
            .maybeSingle(),
        ]);

        if (!isMounted) return;

        if (assignmentRes.error) throw assignmentRes.error;
        if (targetRes.error && targetRes.error.code !== 'PGRST116') throw targetRes.error;
        if (submissionRes.error && submissionRes.error.code !== 'PGRST116') throw submissionRes.error;

        setAssignment(assignmentRes.data || null);
        setTarget(targetRes.data || null);
        setSubmission(submissionRes.data || null);
      } catch (loadError: any) {
        if (!isMounted) return;
        setError(loadError?.message || 'Unable to load this assignment.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadDetail();

    return () => {
      isMounted = false;
    };
  }, [assignmentId, activeChildId, supabase]);

  useEffect(() => {
    let active = true;

    const resolveAttachments = async () => {
      const rawUrls = Array.isArray(assignment?.attachment_urls) ? (assignment.attachment_urls as string[]) : [];
      if (rawUrls.length === 0) {
        setAttachments([]);
        return;
      }

      setResolvingAttachments(true);

      try {
        const resolvedUrls = await Promise.all(
          rawUrls.map(async (url) => {
            if (!url.includes('/storage/v1/object/')) return url;
            const path = extractStoragePathFromUrl(url, 'homework-files');
            if (!path) return url;

            const { data, error } = await supabase.storage
              .from('homework-files')
              .createSignedUrl(path, 60 * 60 * 12);

            if (error) return url;
            return data?.signedUrl || url;
          }),
        );

        if (!active) return;
        setAttachments(
          resolvedUrls
            .filter((entry): entry is string => Boolean(entry))
            .map((url) => ({ url, isImage: isImageUrl(url) })),
        );
      } finally {
        if (active) setResolvingAttachments(false);
      }
    };

    void resolveAttachments();

    return () => {
      active = false;
    };
  }, [assignment?.attachment_urls, supabase]);

  const activeChild = useMemo(
    () => children.find((child: any) => child.id === activeChildId) || null,
    [activeChildId, children],
  );

  const extension = useMemo(() => {
    const value = assignment?.metadata?.take_home_extension;
    if (!value || typeof value !== 'object') return null;
    return value as TakeHomeExtension;
  }, [assignment?.metadata]);

  const hasNamePractice = Boolean(extension?.name_practice?.enabled);

  const imageAttachments = useMemo(
    () => attachments.filter((item) => item.isImage),
    [attachments],
  );

  useEffect(() => {
    setSubmissionText(String(submission?.submission_text || ''));
    setSubmissionFiles([]);
    setSubmitError(null);
  }, [submission?.id, activeChildId]);

  const submittedFileUrls = useMemo(() => {
    const urls = new Set<string>();

    const metadataFiles = (submission as any)?.content_metadata?.files;
    if (Array.isArray(metadataFiles)) {
      metadataFiles.forEach((url) => {
        if (typeof url === 'string' && url) urls.add(url);
      });
    }

    if (Array.isArray(submission?.file_urls)) {
      submission.file_urls.forEach((url: string) => {
        if (url) urls.add(url);
      });
    }

    if (typeof submission?.content_url === 'string' && submission.content_url) {
      urls.add(submission.content_url);
    }

    const media = (submission as any)?.media_urls;
    if (Array.isArray(media)) {
      media.forEach((url) => {
        if (typeof url === 'string' && url) urls.add(url);
      });
    }

    return Array.from(urls);
  }, [submission]);

  const openAttachment = useCallback(async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Cannot open file', 'This file cannot be opened on this device.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open file', 'Try again in a moment.');
    }
  }, []);

  const launchCamera = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Camera permission required', 'Please allow camera access to capture worksheet photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets[0]) return;
    setPendingPreview(result.assets[0].uri);
  }, []);

  const handleTakePhoto = useCallback(async () => {
    try {
      await launchCamera();
    } catch {
      Alert.alert('Camera failed', 'Could not capture photo. Try again.');
    }
  }, [launchCamera]);

  const addFileToUpload = useCallback((uri: string) => {
    const name = sanitizeFileName(`worksheet_${Date.now()}.jpg`);
    setSubmissionFiles((prev) => [
      ...prev,
      { uri, name, mimeType: 'image/jpeg', size: undefined },
    ]);
    setSubmitError(null);
  }, []);

  const handleRetake = useCallback(async () => {
    setPendingPreview(null);
    try {
      await launchCamera();
    } catch {
      Alert.alert('Camera failed', 'Could not capture photo. Try again.');
    }
  }, [launchCamera]);

  const handlePickFromGallery = useCallback(async () => {
    try {
      const hasPermission = await ensureImageLibraryPermission();
      if (!hasPermission) {
        Alert.alert('Gallery permission required', 'Please allow photo library access to attach worksheet photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 5,
        quality: 0.85,
      });

      if (result.canceled || result.assets.length === 0) return;
      const nextFiles = result.assets.map((asset) => {
        const name = sanitizeFileName(asset.fileName || `worksheet_${Date.now()}.jpg`);
        return {
          uri: asset.uri,
          name,
          mimeType: asset.mimeType || resolveMimeTypeFromName(name),
          size: asset.fileSize || undefined,
        } as SubmissionUploadFile;
      });

      setSubmissionFiles((prev) => [...prev, ...nextFiles].slice(0, 8));
      setSubmitError(null);
    } catch {
      Alert.alert('Gallery failed', 'Could not open gallery right now.');
    }
  }, []);

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const name = sanitizeFileName(asset.name || `worksheet_${Date.now()}`);
      setSubmissionFiles((prev) => [
        ...prev,
        {
          uri: asset.uri,
          name,
          mimeType: asset.mimeType || resolveMimeTypeFromName(name),
          size: asset.size || undefined,
        },
      ]);
      setSubmitError(null);
    } catch {
      Alert.alert('File picker failed', 'Could not select a file. Try again.');
    }
  }, []);

  const handleRemoveSubmissionFile = useCallback((index: number) => {
    setSubmissionFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  }, []);

  const handleSubmitWork = useCallback(async () => {
    if (!assignment?.id || !activeChild?.id) {
      setSubmitError('Missing assignment or student context.');
      return;
    }

    const message = submissionText.trim();
    if (!message && submissionFiles.length === 0) {
      setSubmitError('Add a note or attach at least one worksheet file.');
      return;
    }

    setSubmittingWork(true);
    setSubmitError(null);
    setIsUploading(submissionFiles.length > 0);
    setUploadProgress(0);

    try {
      const uploadedUrls: string[] = [];
      const uploadedNames: string[] = [];
      const totalFiles = submissionFiles.length;

      for (let i = 0; i < submissionFiles.length; i++) {
        const file = submissionFiles[i];
        const safeName = sanitizeFileName(file.name || `worksheet_${Date.now()}`);
        const storagePath = `homework_submissions/${assignment.preschool_id || 'school'}/${assignment.id}/${activeChild.id}/${Date.now()}_${safeName}`;

        setUploadProgress(totalFiles > 0 ? Math.round((i / totalFiles) * 100) : 0);

        const response = await fetch(file.uri);
        if (!response.ok) throw new Error(`Could not read ${safeName}`);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('homework-files')
          .upload(storagePath, blob, {
            contentType: file.mimeType || resolveMimeTypeFromName(safeName),
            upsert: false,
          });

        if (uploadError) throw new Error(uploadError.message || `Upload failed for ${safeName}`);

        const { data: urlData } = supabase.storage.from('homework-files').getPublicUrl(storagePath);
        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
          uploadedNames.push(safeName);
        }

        setUploadProgress(totalFiles > 0 ? Math.round(((i + 1) / totalFiles) * 100) : 100);
      }

      const submittedBy = (profile as any)?.id || user?.id || null;
      const nowIso = new Date().toISOString();
      const metadata = {
        files: uploadedUrls,
        file_names: uploadedNames,
        file_count: uploadedUrls.length,
        submission_source: 'parent_mobile',
        submission_mode: 'physical_worksheet',
      };
      const payload = {
        assignment_id: assignment.id,
        homework_assignment_id: assignment.id,
        student_id: activeChild.id,
        preschool_id: assignment.preschool_id || activeChild.preschoolId || null,
        submitted_by: submittedBy,
        submitted_at: nowIso,
        status: 'submitted',
        submission_text: message || null,
        submission_type: uploadedUrls.length > 0 ? (message ? 'mixed' : 'file') : 'text',
        content_type: uploadedUrls.length > 0 ? (message ? 'mixed' : 'file') : 'text',
        content_url: uploadedUrls[0] || null,
        file_urls: uploadedUrls.length > 0 ? uploadedUrls : null,
        media_urls: uploadedUrls.length > 0 ? uploadedUrls : null,
        content_metadata: metadata,
      };

      if (submission?.id) {
        const { data: updated, error: updateError } = await supabase
          .from('homework_submissions')
          .update(payload)
          .eq('id', submission.id)
          .select('*')
          .single();
        if (updateError) throw new Error(updateError.message || 'Could not update submission');
        setSubmission(updated || null);
      } else {
        const { data: created, error: createError } = await supabase
          .from('homework_submissions')
          .insert(payload)
          .select('*')
          .single();
        if (createError) throw new Error(createError.message || 'Could not submit homework');
        setSubmission(created || null);
      }

      setSubmissionFiles([]);
      setSubmissionText('');
      Alert.alert('Submission saved', 'Your physical homework has been submitted to the teacher.');
    } catch (submitWorkError: any) {
      setSubmitError(submitWorkError?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmittingWork(false);
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [activeChild, assignment, profile, submission, submissionFiles, submissionText, supabase, user?.id]);

  const dueLabel = formatDueLabel(target?.due_at || assignment?.due_date);

  const styles = createStyles(theme);

  if (!assignmentId) {
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
        title={assignment?.title || 'Take-home details'}
        subtitle={activeChild ? `${activeChild.firstName} ${activeChild.lastName}`.trim() : 'Assignment overview'}
        rightAction={{
          icon: 'refresh-outline',
          onPress: () => {
            void refresh();
          },
          label: 'Refresh',
        }}
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}>
        {children.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.childChips}>
            {children.map((child: any) => {
              const selected = activeChildId === child.id;
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
                  onPress={() => setActiveChildId(child.id)}
                >
                  <Text style={{ color: selected ? theme.primary : theme.text, fontWeight: selected ? '700' : '500' }}>
                    {child.firstName || child.first_name || 'Child'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {dashboardLoading || loading ? (
          <View style={{ gap: 10 }}>
            {[1, 2, 3].map((item) => (
              <SkeletonLoader key={item} width="100%" height={100} borderRadius={14} />
            ))}
          </View>
        ) : error ? (
          <View style={[styles.card, { borderColor: theme.error }]}> 
            <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          </View>
        ) : !assignment ? (
          <View style={styles.centerContent}>
            <Text style={[styles.errorText, { color: theme.textSecondary }]}>This assignment is not available.</Text>
          </View>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
              <View style={styles.summaryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Status</Text>
                  <Text style={[styles.value, { color: theme.text }]}>{submission ? 'Submitted' : 'Not submitted'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Due</Text>
                  <Text style={[styles.value, { color: theme.text }]}>{dueLabel}</Text>
                </View>
              </View>

              <View style={[styles.badgeRow, { marginTop: 10 }]}> 
                <View style={[styles.badge, { backgroundColor: `${theme.primary}1f` }]}> 
                  <Text style={[styles.badgeText, { color: theme.primary }]}>{assignment.subject || 'Take-home'}</Text>
                </View>
                {assignment.grade_band ? (
                  <View style={[styles.badge, { backgroundColor: `${theme.info}1f` }]}> 
                    <Text style={[styles.badgeText, { color: theme.info }]}>{assignment.grade_band}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
              <Text style={[styles.cardTitle, { color: theme.text }]}>Instructions</Text>
              <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
                {assignment.description || assignment.instructions || 'No instructions provided.'}
              </Text>

              {extension?.at_home_steps && extension.at_home_steps.length > 0 && (
                <View style={{ marginTop: 12, gap: 6 }}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Worksheet companion steps</Text>
                  {extension.at_home_steps.map((step, index) => (
                    <Text key={`step-${index}`} style={[styles.bodyText, { color: theme.text }]}>
                      {index + 1}. {step}
                    </Text>
                  ))}
                </View>
              )}

              {extension?.parent_prompt ? (
                <View style={[styles.promptCard, { backgroundColor: theme.background, borderColor: theme.border }]}> 
                  <Text style={[styles.bodyText, { color: theme.textSecondary }]}>{extension.parent_prompt}</Text>
                </View>
              ) : null}
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
              <Text style={[styles.cardTitle, { color: theme.text }]}>Worksheet files</Text>
              {resolvingAttachments && <Text style={[styles.bodyText, { color: theme.textSecondary }]}>Loading files...</Text>}

              {imageAttachments.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
                  {imageAttachments.map((attachment, index) => (
                    <TouchableOpacity key={`image-${index}`} onPress={() => void openAttachment(attachment.url)}>
                      <Image source={{ uri: attachment.url }} style={styles.previewImage} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <View style={{ gap: 8, marginTop: 10 }}>
                {attachments.map((attachment, index) => (
                  <TouchableOpacity
                    key={`attachment-${index}`}
                    style={[styles.fileRow, { borderColor: theme.border, backgroundColor: theme.background }]}
                    onPress={() => void openAttachment(attachment.url)}
                  >
                    <View style={styles.fileMeta}>
                      <Ionicons name={attachment.isImage ? 'image-outline' : 'document-outline'} size={18} color={theme.primary} />
                      <Text style={[styles.fileLabel, { color: theme.text }]}>Attachment {index + 1}</Text>
                    </View>
                    <Ionicons name="open-outline" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
              <Text style={[styles.cardTitle, { color: theme.text }]}>Submit Physical Worksheet</Text>
              <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
                Upload clear photos or a PDF of the worksheet completed at home.
              </Text>

              <View style={styles.summaryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Submitted</Text>
                  <Text style={[styles.value, { color: theme.text }]}>{formatDateTime(submission?.submitted_at)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Files</Text>
                  <Text style={[styles.value, { color: theme.text }]}>{submittedFileUrls.length}</Text>
                </View>
              </View>

              <TextInput
                value={submissionText}
                onChangeText={setSubmissionText}
                placeholder="Add a short note for the teacher (optional)"
                placeholderTextColor={theme.textSecondary}
                multiline
                style={[
                  styles.noteInput,
                  { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
                ]}
              />

              <View style={styles.uploadActionRow}>
                <TouchableOpacity
                  style={[styles.uploadActionButton, { borderColor: theme.border, backgroundColor: theme.background }]}
                  onPress={handleTakePhoto}
                >
                  <Ionicons name="camera-outline" size={16} color={theme.text} />
                  <Text style={[styles.uploadActionLabel, { color: theme.text }]}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.uploadActionButton, { borderColor: theme.border, backgroundColor: theme.background }]}
                  onPress={handlePickFromGallery}
                >
                  <Ionicons name="images-outline" size={16} color={theme.text} />
                  <Text style={[styles.uploadActionLabel, { color: theme.text }]}>Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.uploadActionButton, { borderColor: theme.border, backgroundColor: theme.background }]}
                  onPress={handlePickDocument}
                >
                  <Ionicons name="document-outline" size={16} color={theme.text} />
                  <Text style={[styles.uploadActionLabel, { color: theme.text }]}>PDF/File</Text>
                </TouchableOpacity>
              </View>

              {submissionFiles.length > 0 && (
                <View style={{ gap: 8 }}>
                  {submissionFiles.map((file, index) => {
                    const isImage = file.mimeType.startsWith('image/');
                    return (
                      <View
                        key={`${file.uri}-${index}`}
                        style={[styles.pendingFileRow, { borderColor: theme.border, backgroundColor: theme.background }]}
                      >
                        <View style={styles.fileMeta}>
                          <Ionicons name={isImage ? 'image-outline' : 'document-text-outline'} size={18} color={theme.primary} />
                          <Text style={[styles.fileLabel, { color: theme.text }]} numberOfLines={1}>
                            {file.name}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => handleRemoveSubmissionFile(index)}>
                          <Ionicons name="close-circle" size={20} color={theme.error} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {submittedFileUrls.length > 0 && (
                <View style={{ gap: 8 }}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Previous submission files</Text>
                  {submittedFileUrls.map((url, index) => (
                    <TouchableOpacity
                      key={`${url}-${index}`}
                      style={[styles.fileRow, { borderColor: theme.border, backgroundColor: theme.background }]}
                      onPress={() => void openAttachment(url)}
                    >
                      <View style={styles.fileMeta}>
                        <Ionicons name="cloud-done-outline" size={18} color={theme.success} />
                        <Text style={[styles.fileLabel, { color: theme.text }]}>Submitted file {index + 1}</Text>
                      </View>
                      <Ionicons name="open-outline" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {isUploading && (
                <View style={uploadStyles.progressContainer}>
                  <View style={uploadStyles.progressTrack}>
                    <View style={[uploadStyles.progressBar, { width: `${uploadProgress}%`, backgroundColor: theme.primary }]} />
                  </View>
                  <Text style={[uploadStyles.progressText, { color: theme.textSecondary }]}>
                    {uploadProgress < 100 ? `${Math.round(uploadProgress)}% uploading...` : 'Finalising...'}
                  </Text>
                </View>
              )}

              {submitError ? (
                <Text style={[styles.submitErrorText, { color: theme.error }]}>{submitError}</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  {
                    backgroundColor:
                      submittingWork || (!submissionText.trim() && submissionFiles.length === 0)
                        ? `${theme.primary}66`
                        : theme.primary,
                  },
                ]}
                onPress={() => void handleSubmitWork()}
                disabled={submittingWork || (!submissionText.trim() && submissionFiles.length === 0)}
              >
                {submittingWork ? (
                  <Text style={styles.submitButtonText}>Submitting...</Text>
                ) : (
                  <>
                    <Ionicons name="paper-plane-outline" size={16} color={theme.onPrimary || '#fff'} />
                    <Text style={styles.submitButtonText}>Submit to Teacher</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
              <Text style={[styles.cardTitle, { color: theme.text }]}>Quick actions</Text>

              <View style={styles.actionGrid}>
                {hasNamePractice && (
                  <TouchableOpacity
                    style={[styles.actionButton, { borderColor: theme.primary, backgroundColor: `${theme.primary}14` }]}
                    onPress={() => setShowNamePractice((prev) => !prev)}
                  >
                    <Ionicons name="create-outline" size={18} color={theme.primary} />
                    <Text style={[styles.actionLabel, { color: theme.primary }]}>
                      {showNamePractice ? 'Hide Name Practice' : 'Start Name Practice'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionButton, { borderColor: theme.border, backgroundColor: theme.background }]}
                  onPress={() => router.push(`/screens/ai-homework-helper?homeworkId=${assignment.id}`)}
                >
                  <Ionicons name="sparkles-outline" size={18} color={theme.text} />
                  <Text style={[styles.actionLabel, { color: theme.text }]}>AI Homework Help</Text>
                </TouchableOpacity>
              </View>

              {starterClips.length > 0 && (
                <View style={{ marginTop: 12, gap: 8 }}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Phonics clips</Text>
                  <View style={styles.clipWrap}>
                    {starterClips.map((clip) => (
                      <TouchableOpacity
                        key={clip.id}
                        style={[
                          styles.clipButton,
                          {
                            borderColor: `${theme.primary}55`,
                            backgroundColor: activeClipId === clip.id ? `${theme.primary}2b` : theme.background,
                          },
                        ]}
                        onPress={() => playClip(clip.id)}
                      >
                        <Ionicons name="volume-medium" size={14} color={theme.primary} />
                        <Text style={[styles.clipText, { color: theme.text }]}>{clip.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {showNamePractice && activeChild && (
              <NamePracticePad
                studentId={activeChild.id}
                preschoolId={assignment.preschool_id || activeChild.preschoolId}
                assignmentId={assignment.id}
                childName={`${activeChild.firstName} ${activeChild.lastName}`.trim()}
                targetName={activeChild.firstName || undefined}
              />
            )}
          </>
        )}
      </ScrollView>

      {pendingPreview && (
        <Modal visible transparent animationType="fade">
          <View style={previewStyles.container}>
            <Image source={{ uri: pendingPreview }} style={previewStyles.image} resizeMode="contain" />
            <View style={previewStyles.actions}>
              <TouchableOpacity style={previewStyles.cancelButton} onPress={() => setPendingPreview(null)}>
                <Ionicons name="close" size={20} color="#fff" />
                <Text style={previewStyles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={previewStyles.retakeButton} onPress={handleRetake}>
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={previewStyles.buttonText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={previewStyles.useButton}
                onPress={() => {
                  addFileToUpload(pendingPreview);
                  setPendingPreview(null);
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
    container: {
      flex: 1,
    },
    content: {
      padding: 16,
      gap: 12,
    },
    centerContent: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
    },
    card: {
      borderWidth: 1,
      borderRadius: 14,
      padding: 14,
      gap: 10,
    },
    errorText: {
      fontSize: 14,
      textAlign: 'center',
      fontWeight: '600',
    },
    childChips: {
      gap: 8,
      paddingBottom: 4,
    },
    childChip: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: 12,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    value: {
      marginTop: 4,
      fontSize: 16,
      fontWeight: '700',
    },
    badgeRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '700',
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: '700',
    },
    bodyText: {
      fontSize: 14,
      lineHeight: 20,
    },
    promptCard: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 10,
      marginTop: 6,
    },
    previewRow: {
      gap: 8,
      paddingVertical: 4,
    },
    previewImage: {
      width: 170,
      height: 110,
      borderRadius: 10,
      backgroundColor: '#0f172a',
    },
    fileRow: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fileMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    fileLabel: {
      fontSize: 14,
      fontWeight: '600',
      maxWidth: '88%',
    },
    noteInput: {
      minHeight: 84,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      textAlignVertical: 'top',
      fontSize: 14,
      lineHeight: 20,
    },
    uploadActionRow: {
      flexDirection: 'row',
      gap: 8,
    },
    uploadActionButton: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    uploadActionLabel: {
      fontSize: 13,
      fontWeight: '700',
    },
    pendingFileRow: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 9,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    submitErrorText: {
      fontSize: 13,
      fontWeight: '600',
    },
    submitButton: {
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    submitButtonText: {
      color: theme.onPrimary || '#fff',
      fontSize: 14,
      fontWeight: '800',
    },
    actionGrid: {
      gap: 8,
    },
    actionButton: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    actionLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
    clipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    clipButton: {
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 7,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    clipText: {
      fontSize: 12,
      fontWeight: '600',
    },
  });

const previewStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '70%',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
    paddingHorizontal: 20,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#555',
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#e67e22',
  },
  useButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#27ae60',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

const uploadStyles = StyleSheet.create({
  progressContainer: {
    gap: 6,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
