/**
 * useHomeworkDetail
 *
 * Data fetching and state management for the homework detail screen.
 * Extracted from homework-detail.tsx to keep the screen composition slim.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { useParentDashboard } from '@/hooks/useDashboardData';
import { usePhonicsClips } from '@/hooks/usePhonicsClips';
import { ensureImageLibraryPermission } from '@/lib/utils/mediaLibrary';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

export interface TakeHomeExtension {
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

export interface AttachmentItem {
  url: string;
  isImage: boolean;
}

export interface SubmissionUploadFile {
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

export function sanitizeFileName(name: string): string {
  return String(name || 'file')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 100) || `file_${Date.now()}`;
}

export function resolveMimeTypeFromName(name: string): string {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

export function formatDateTime(value?: string | null): string {
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

export function formatDueLabel(input?: string | null): string {
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

export function useHomeworkDetail() {
  const { user, profile } = useAuth();
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

  return {
    assignmentId,
    dashboardLoading,
    refresh,
    children,
    activeChildId,
    setActiveChildId,
    assignment,
    target,
    submission,
    loading,
    error,
    showNamePractice,
    setShowNamePractice,
    attachments,
    resolvingAttachments,
    submissionText,
    setSubmissionText,
    submissionFiles,
    submittingWork,
    submitError,
    pendingPreview,
    setPendingPreview,
    uploadProgress,
    isUploading,
    starterClips,
    activeClipId,
    playClip,
    activeChild,
    extension,
    hasNamePractice,
    imageAttachments,
    submittedFileUrls,
    openAttachment,
    handleTakePhoto,
    addFileToUpload,
    handleRetake,
    handlePickFromGallery,
    handlePickDocument,
    handleRemoveSubmissionFile,
    handleSubmitWork,
    dueLabel,
  };
}
