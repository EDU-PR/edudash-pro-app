/**
 * Teacher Post Activity Screen
 * 
 * Allows teachers to quickly post daily activities to the parent feed.
 * Features:
 * - Quick-post buttons for common activities
 * - Photo/video upload (batch support)
 * - Activity description with voice-to-text
 * - Student/class selection
 * - Visibility settings
 * - Template messages
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { uploadMultipleImages } from '@/lib/ai/simple-image-upload';
import { DesktopLayout } from '@/components/layout/DesktopLayout';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  class_id?: string;
}

interface Class {
  id: string;
  name: string;
}

type ActivityType = 'learning' | 'play' | 'meal' | 'rest' | 'special' | 'milestone' | 'outdoor' | 'art' | 'music' | 'story' | 'social';
type Visibility = 'parent_only' | 'class_parents' | 'all_parents' | 'private';

const ACTIVITY_TYPES: { type: ActivityType; icon: string; color: string; label: string }[] = [
  { type: 'learning', icon: 'school', color: '#3B82F6', label: 'Learning' },
  { type: 'play', icon: 'game-controller', color: '#10B981', label: 'Play' },
  { type: 'meal', icon: 'restaurant', color: '#EF4444', label: 'Meal' },
  { type: 'rest', icon: 'moon', color: '#6366F1', label: 'Rest' },
  { type: 'art', icon: 'color-palette', color: '#EC4899', label: 'Art' },
  { type: 'music', icon: 'musical-notes', color: '#8B5CF6', label: 'Music' },
  { type: 'story', icon: 'book', color: '#0EA5E9', label: 'Story' },
  { type: 'outdoor', icon: 'sunny', color: '#F59E0B', label: 'Outdoor' },
  { type: 'special', icon: 'star', color: '#F97316', label: 'Special' },
  { type: 'milestone', icon: 'trophy', color: '#EAB308', label: 'Milestone' },
  { type: 'social', icon: 'people', color: '#06B6D4', label: 'Social' },
];

const TEMPLATES: Record<ActivityType, string[]> = {
  learning: [
    'We practiced counting and number recognition today',
    'Learning about colors and shapes',
    'Working on letter recognition and phonics',
  ],
  play: [
    'Had fun with building blocks and imagination',
    'Enjoyed outdoor playtime with friends',
    'Played educational games together',
  ],
  meal: [
    'Enjoyed a healthy lunch together',
    'Snack time - practicing table manners',
    'Great job trying new foods today!',
  ],
  rest: [
    'Peaceful nap time',
    'Quiet time with books',
    'Rest and relaxation',
  ],
  art: [
    'Creative art project completed',
    'Painting and drawing time',
    'Exploring different art materials',
  ],
  music: [
    'Music and movement activities',
    'Learning new songs together',
    'Dance and rhythm time',
  ],
  story: [
    'Story time - enjoyed a wonderful book',
    'Reading and comprehension activities',
    'Interactive storytelling session',
  ],
  outdoor: [
    'Outdoor exploration and nature walk',
    'Playing outside and enjoying fresh air',
    'Physical activities and games',
  ],
  special: [
    'Special activity today!',
    'Field trip and adventure',
    'Guest visitor presentation',
  ],
  milestone: [
    'Achieved a new milestone today!',
    'Great progress observed',
    'Wonderful development moment',
  ],
  social: [
    'Practicing sharing and taking turns',
    'Working together as a team',
    'Making new friends and social skills',
  ],
};

export default function TeacherPostActivityScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);

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

  const loadClassesAndStudents = async () => {
    if (!preschoolId) return;

    setLoading(true);
    try {
      const supabase = assertSupabase();

      // Load classes
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id, name')
        .eq('preschool_id', preschoolId)
        .order('name');

      if (classError) throw classError;
      setClasses(classData || []);

      // Load students
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, first_name, last_name, class_id')
        .eq('preschool_id', preschoolId)
        .order('first_name');

      if (studentError) throw studentError;
      setStudents(studentData || []);
    } catch (error) {
      console.error('[TeacherPostActivity] Error loading data:', error);
      Alert.alert('Error', 'Failed to load classes and students');
    } finally {
      setLoading(false);
    }
  };

  const pickImages = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to access photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset => asset.uri);
        setSelectedImages(prev => [...prev, ...newImages].slice(0, 5));
      }
    } catch (error) {
      console.error('[TeacherPostActivity] Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to access camera');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImages(prev => [...prev, result.assets[0].uri].slice(0, 5));
      }
    } catch (error) {
      console.error('[TeacherPostActivity] Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const removeImage = (uri: string) => {
    setSelectedImages(prev => prev.filter(img => img !== uri));
  };

  const selectTemplate = (template: string) => {
    setDescription(template);
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const selectAllInClass = (classId: string) => {
    const classStudents = students.filter(s => s.class_id === classId);
    const allSelected = classStudents.every(s => selectedStudents.includes(s.id));
    
    if (allSelected) {
      setSelectedStudents(prev => prev.filter(id => !classStudents.find(s => s.id === id)));
    } else {
      setSelectedStudents(prev => [
        ...prev,
        ...classStudents.map(s => s.id).filter(id => !prev.includes(id))
      ]);
    }
  };

  const postActivity = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter an activity title');
      return;
    }

    if (selectedStudents.length === 0 && !selectedClass) {
      Alert.alert('Required', 'Please select at least one student or a class');
      return;
    }

    if (!preschoolId || !profile?.id) {
      Alert.alert('Error', 'Missing organization information');
      return;
    }

    setPosting(true);
    try {
      const supabase = assertSupabase();
      
      // Upload images if any
      let mediaUrls: string[] = [];
      if (selectedImages.length > 0) {
        console.log('[TeacherPostActivity] Uploading images...');
        const uploads = await uploadMultipleImages(selectedImages, false);
        mediaUrls = uploads.map(u => u.url);
      }

      // Determine which students to post for
      const targetStudents = selectedStudents.length > 0
        ? selectedStudents
        : students.filter(s => s.class_id === selectedClass).map(s => s.id);

      if (targetStudents.length === 0) {
        Alert.alert('Error', 'No students selected');
        setPosting(false);
        return;
      }

      // Create activity for each student
      const activities = targetStudents.map(studentId => ({
        preschool_id: preschoolId,
        class_id: selectedClass || students.find(s => s.id === studentId)?.class_id,
        student_id: studentId,
        teacher_id: profile.id,
        activity_type: selectedType,
        title: title.trim(),
        description: description.trim() || null,
        media_urls: mediaUrls,
        visibility,
        duration_minutes: duration ? parseInt(duration) : null,
        activity_at: new Date().toISOString(),
        is_published: true,
      }));

      const { error } = await supabase
        .from('student_activity_feed')
        .insert(activities);

      if (error) throw error;

      Alert.alert('Success', `Activity posted for ${targetStudents.length} student(s)`, [
        {
          text: 'Post Another',
          onPress: () => {
            // Reset form
            setTitle('');
            setDescription('');
            setSelectedImages([]);
            setSelectedStudents([]);
            setDuration('');
          },
        },
        {
          text: 'Done',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('[TeacherPostActivity] Error posting activity:', error);
      Alert.alert('Error', 'Failed to post activity. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <DesktopLayout role="teacher">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading...
          </Text>
        </View>
      </DesktopLayout>
    );
  }

  return (
    <DesktopLayout role="teacher">
      <Stack.Screen
        options={{
          title: 'Post Activity',
          headerShown: true,
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
        }}
      />
      <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Activity Type Selection */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Activity Type</Text>
          <View style={styles.typeGrid}>
            {ACTIVITY_TYPES.map(({ type, icon, color, label }) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  selectedType === type && { backgroundColor: color + '20', borderColor: color },
                ]}
                onPress={() => setSelectedType(type)}
              >
                <Ionicons name={icon as any} size={28} color={color} />
                <Text style={[styles.typeLabel, { color: theme.text }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Title */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Activity Title *</Text>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            placeholder="e.g., Learning about colors"
            placeholderTextColor={theme.textTertiary}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
        </View>

        {/* Templates */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Templates</Text>
          <View style={styles.templateContainer}>
            {TEMPLATES[selectedType].map((template, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.templateButton, { borderColor: theme.border }]}
                onPress={() => selectTemplate(template)}
              >
                <Text style={[styles.templateText, { color: theme.primary }]}>
                  {template}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Description */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Description</Text>
          <TextInput
            style={[styles.textArea, { color: theme.text, borderColor: theme.border }]}
            placeholder="Share details about this activity..."
            placeholderTextColor={theme.textTertiary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
        </View>

        {/* Photos */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Photos ({selectedImages.length}/5)
          </Text>
          <View style={styles.photoActions}>
            <TouchableOpacity
              style={[styles.photoButton, { backgroundColor: theme.primary }]}
              onPress={takePhoto}
            >
              <Ionicons name="camera" size={20} color="#FFF" />
              <Text style={styles.photoButtonText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.photoButton, { backgroundColor: theme.info }]}
              onPress={pickImages}
            >
              <Ionicons name="images" size={20} color="#FFF" />
              <Text style={styles.photoButtonText}>Choose Photos</Text>
            </TouchableOpacity>
          </View>
          {selectedImages.length > 0 && (
            <View style={styles.imageGrid}>
              {selectedImages.map((uri, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{ uri }} style={styles.image} />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeImage(uri)}
                  >
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Duration */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Duration (minutes)</Text>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            placeholder="Optional"
            placeholderTextColor={theme.textTertiary}
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>

        {/* Class Selection */}
        {classes.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Select by Class (Optional)
            </Text>
            {classes.map(cls => {
              const classStudents = students.filter(s => s.class_id === cls.id);
              const allSelected = classStudents.length > 0 && classStudents.every(s => selectedStudents.includes(s.id));
              return (
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.classButton, { borderColor: theme.border }]}
                  onPress={() => {
                    setSelectedClass(cls.id);
                    selectAllInClass(cls.id);
                  }}
                >
                  <Ionicons
                    name={allSelected ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={allSelected ? theme.primary : theme.textSecondary}
                  />
                  <Text style={[styles.classText, { color: theme.text }]}>
                    {cls.name} ({classStudents.length} students)
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Student Selection */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Select Students * ({selectedStudents.length} selected)
          </Text>
          <ScrollView style={styles.studentList} nestedScrollEnabled>
            {students.map(student => (
              <TouchableOpacity
                key={student.id}
                style={styles.studentButton}
                onPress={() => toggleStudent(student.id)}
              >
                <Ionicons
                  name={selectedStudents.includes(student.id) ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={selectedStudents.includes(student.id) ? theme.primary : theme.textSecondary}
                />
                <Text style={[styles.studentText, { color: theme.text }]}>
                  {student.first_name} {student.last_name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Visibility */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Visibility</Text>
          <View style={styles.visibilityButtons}>
            {[
              { value: 'parent_only' as Visibility, label: 'Parent Only', icon: 'person' },
              { value: 'class_parents' as Visibility, label: 'Class Parents', icon: 'people' },
              { value: 'all_parents' as Visibility, label: 'All Parents', icon: 'globe' },
            ].map(({ value, label, icon }) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.visibilityButton,
                  { borderColor: theme.border },
                  visibility === value && { backgroundColor: theme.primary + '20', borderColor: theme.primary },
                ]}
                onPress={() => setVisibility(value)}
              >
                <Ionicons name={icon as any} size={20} color={visibility === value ? theme.primary : theme.textSecondary} />
                <Text style={[styles.visibilityText, { color: visibility === value ? theme.primary : theme.text }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Post Button */}
        <TouchableOpacity
          style={[styles.postButton, { backgroundColor: theme.success }, posting && styles.postButtonDisabled]}
          onPress={postActivity}
          disabled={posting}
        >
          {posting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#FFF" />
              <Text style={styles.postButtonText}>Post Activity</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </DesktopLayout>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
    },
    section: {
      margin: 16,
      padding: 16,
      borderRadius: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 12,
    },
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    typeButton: {
      width: '30%',
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 2,
      borderColor: 'transparent',
      gap: 6,
    },
    typeLabel: {
      fontSize: 12,
      fontWeight: '500',
    },
    input: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
    },
    textArea: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      minHeight: 100,
      textAlignVertical: 'top',
    },
    templateContainer: {
      gap: 8,
    },
    templateButton: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
    },
    templateText: {
      fontSize: 14,
    },
    photoActions: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    photoButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      borderRadius: 8,
      gap: 8,
    },
    photoButtonText: {
      color: '#FFF',
      fontSize: 14,
      fontWeight: '600',
    },
    imageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    imageWrapper: {
      width: 100,
      height: 100,
      position: 'relative',
    },
    image: {
      width: '100%',
      height: '100%',
      borderRadius: 8,
    },
    removeButton: {
      position: 'absolute',
      top: -8,
      right: -8,
    },
    classButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderWidth: 1,
      borderRadius: 8,
      marginBottom: 8,
      gap: 12,
    },
    classText: {
      fontSize: 15,
      fontWeight: '500',
    },
    studentList: {
      maxHeight: 200,
    },
    studentButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      gap: 12,
    },
    studentText: {
      fontSize: 15,
    },
    visibilityButtons: {
      gap: 8,
    },
    visibilityButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderWidth: 2,
      borderRadius: 8,
      gap: 12,
    },
    visibilityText: {
      fontSize: 15,
      fontWeight: '500',
    },
    postButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      margin: 16,
      padding: 16,
      borderRadius: 12,
      gap: 8,
    },
    postButtonDisabled: {
      opacity: 0.6,
    },
    postButtonText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });
