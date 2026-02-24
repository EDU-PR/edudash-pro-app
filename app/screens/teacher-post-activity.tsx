/**
 * Teacher Post Activity Screen
 *
 * Allows teachers to quickly post daily activities to the parent feed.
 * Features: quick-post buttons, photo upload, templates, student/class selection.
 */

import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlertModal } from '@/components/ui/AlertModal';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { useTeacherPostActivity } from '@/hooks/useTeacherPostActivity';
import { ACTIVITY_TYPES, TEMPLATES } from '@/features/teacher-post-activity/teacher-post-activity.constants';
import type { Visibility } from '@/features/teacher-post-activity/teacher-post-activity.constants';
import { createStyles } from '@/features/teacher-post-activity/teacher-post-activity.styles';

export default function TeacherPostActivityScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(), []);
  const { showAlert, AlertModalComponent } = useAlertModal();

  const {
    selectedType, setSelectedType, title, setTitle, description, setDescription,
    selectedImages, students, classes, selectedStudents, selectedClass,
    visibility, setVisibility, duration, setDuration, loading, posting,
    pickImages, takePhoto, removeImage, selectTemplate,
    toggleStudent, selectAllInClass, setSelectedClass, postActivity,
  } = useTeacherPostActivity(showAlert);

  if (loading) {
    return (
      <DesktopLayout role="teacher">
        <View style={styles.loadingContainer}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading...</Text>
        </View>
        <AlertModalComponent />
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
                <Text style={[styles.templateText, { color: theme.primary }]}>{template}</Text>
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
                  <TouchableOpacity style={styles.removeButton} onPress={() => removeImage(uri)}>
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
              const allSelected =
                classStudents.length > 0 &&
                classStudents.every(s => selectedStudents.includes(s.id));
              return (
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.classButton, { borderColor: theme.border }]}
                  onPress={() => { setSelectedClass(cls.id); selectAllInClass(cls.id); }}
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
            {([
              { value: 'parent_only' as Visibility, label: 'Parent Only', icon: 'person' },
              { value: 'class_parents' as Visibility, label: 'Class Parents', icon: 'people' },
              { value: 'all_parents' as Visibility, label: 'All Parents', icon: 'globe' },
            ]).map(({ value, label, icon }) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.visibilityButton,
                  { borderColor: theme.border },
                  visibility === value && { backgroundColor: theme.primary + '20', borderColor: theme.primary },
                ]}
                onPress={() => setVisibility(value)}
              >
                <Ionicons
                  name={icon as any}
                  size={20}
                  color={visibility === value ? theme.primary : theme.textSecondary}
                />
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
            <EduDashSpinner color="#FFF" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#FFF" />
              <Text style={styles.postButtonText}>Post Activity</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <AlertModalComponent />
    </DesktopLayout>
  );
}
