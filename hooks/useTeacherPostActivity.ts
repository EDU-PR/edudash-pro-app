/**
 * useTeacherPostActivity Hook
 *
 * All state and logic for the Teacher Post Activity screen.
 * ≤200 lines per WARP standard.
 */

import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { assertSupabase } from '@/lib/supabase';
import { ensureImageLibraryPermission } from '@/lib/utils/mediaLibrary';
import { uploadMultipleImages } from '@/lib/ai/simple-image-upload';
import type { Student, Class, ActivityType, Visibility } from '@/features/teacher-post-activity/teacher-post-activity.constants';

const TAG = 'TeacherPostActivity';

type ShowAlertFn = (opts: {
  title: string;
  message: string;
  buttons?: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[];
}) => void;

export function useTeacherPostActivity(showAlert: ShowAlertFn) {
  const { profile } = useAuth();

  const [selectedType, setSelectedType] = useState<ActivityType>('learning');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>('class_parents');
  const [duration, setDuration] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  const preschoolId = profile?.organization_id || (profile as any)?.preschool_id;

  useEffect(() => {
    loadClassesAndStudents();
  }, [preschoolId]);

  // ── Data Loading ───────────────────────────────────────────────────────

  const loadClassesAndStudents = async () => {
    if (!preschoolId) return;
    setLoading(true);
    try {
      const supabase = assertSupabase();
      const { data: classData, error: classError } = await supabase
        .from('classes').select('id, name')
        .eq('preschool_id', preschoolId).order('name');
      if (classError) throw classError;
      setClasses(classData || []);

      const { data: studentData, error: studentError } = await supabase
        .from('students').select('id, first_name, last_name, class_id')
        .eq('preschool_id', preschoolId).order('first_name');
      if (studentError) throw studentError;
      setStudents(studentData || []);
    } catch (error) {
      logger.error(TAG, 'Error loading data:', error);
      showAlert({ title: 'Error', message: 'Failed to load classes and students' });
    } finally {
      setLoading(false);
    }
  };

  // ── Image Handling ─────────────────────────────────────────────────────

  const pickImages = async () => {
    try {
      const hasPermission = await ensureImageLibraryPermission();
      if (!hasPermission) {
        showAlert({ title: 'Permission needed', message: 'Please grant permission to access photos' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true, quality: 0.8, selectionLimit: 5,
      });
      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(a => a.uri);
        setSelectedImages(prev => [...prev, ...newImages].slice(0, 5));
      }
    } catch (error) {
      logger.error(TAG, 'Error picking images:', error);
      showAlert({ title: 'Error', message: 'Failed to pick images' });
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert({ title: 'Permission needed', message: 'Please grant permission to access camera' });
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
      if (!result.canceled && result.assets[0]) {
        setSelectedImages(prev => [...prev, result.assets[0].uri].slice(0, 5));
      }
    } catch (error) {
      logger.error(TAG, 'Error taking photo:', error);
      showAlert({ title: 'Error', message: 'Failed to take photo' });
    }
  };

  const removeImage = (uri: string) => setSelectedImages(prev => prev.filter(img => img !== uri));

  // ── Selection Helpers ──────────────────────────────────────────────────

  const selectTemplate = (template: string) => setDescription(template);

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId],
    );
  };

  const selectAllInClass = (classId: string) => {
    const cls = students.filter(s => s.class_id === classId);
    const allSelected = cls.every(s => selectedStudents.includes(s.id));
    if (allSelected) {
      setSelectedStudents(prev => prev.filter(id => !cls.find(s => s.id === id)));
    } else {
      setSelectedStudents(prev => [...prev, ...cls.map(s => s.id).filter(id => !prev.includes(id))]);
    }
  };

  // ── Post Activity ──────────────────────────────────────────────────────

  const postActivity = async () => {
    if (!title.trim()) { showAlert({ title: 'Required', message: 'Please enter an activity title' }); return; }
    if (selectedStudents.length === 0 && !selectedClass) { showAlert({ title: 'Required', message: 'Please select at least one student or a class' }); return; }
    if (!preschoolId || !profile?.id) { showAlert({ title: 'Error', message: 'Missing organization information' }); return; }

    setPosting(true);
    try {
      const supabase = assertSupabase();
      let mediaUrls: string[] = [];
      if (selectedImages.length > 0) {
        logger.info(TAG, 'Uploading images...');
        mediaUrls = (await uploadMultipleImages(selectedImages, false)).map(u => u.url);
      }

      const targetStudents = selectedStudents.length > 0
        ? selectedStudents
        : students.filter(s => s.class_id === selectedClass).map(s => s.id);
      if (targetStudents.length === 0) { showAlert({ title: 'Error', message: 'No students selected' }); setPosting(false); return; }

      const activities = targetStudents.map(studentId => ({
        preschool_id: preschoolId,
        class_id: selectedClass || students.find(s => s.id === studentId)?.class_id,
        student_id: studentId, teacher_id: profile.id,
        activity_type: selectedType, title: title.trim(),
        description: description.trim() || null, media_urls: mediaUrls,
        visibility, duration_minutes: duration ? parseInt(duration) : null,
        activity_at: new Date().toISOString(), is_published: true,
      }));

      const { error } = await supabase.from('student_activity_feed').insert(activities);
      if (error) throw error;

      showAlert({
        title: 'Success',
        message: `Activity posted for ${targetStudents.length} student(s)`,
        buttons: [
          { text: 'Post Another', onPress: () => { setTitle(''); setDescription(''); setSelectedImages([]); setSelectedStudents([]); setDuration(''); } },
          { text: 'Done', onPress: () => router.back() },
        ],
      });
    } catch (error) {
      logger.error(TAG, 'Error posting activity:', error);
      showAlert({ title: 'Error', message: 'Failed to post activity. Please try again.' });
    } finally {
      setPosting(false);
    }
  };

  return {
    selectedType, setSelectedType, title, setTitle, description, setDescription,
    selectedImages, students, classes, selectedStudents, selectedClass,
    visibility, setVisibility, duration, setDuration, loading, posting,
    pickImages, takePhoto, removeImage, selectTemplate,
    toggleStudent, selectAllInClass, setSelectedClass, postActivity,
  };
}
