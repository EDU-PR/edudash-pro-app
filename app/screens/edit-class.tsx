/**
 * Edit Class Screen
 * Edit class details (name, grade level, capacity, room, teacher)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { Picker } from '@react-native-picker/picker';

interface Teacher {
  id: string;
  name: string;
  email: string;
}

interface ClassData {
  id: string;
  name: string;
  grade_level: string;
  max_capacity: number;
  room_number: string | null;
  teacher_id: string | null;
  active: boolean;
  preschool_id: string;
}

export default function EditClassScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { classId } = useLocalSearchParams<{ classId: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [formData, setFormData] = useState<ClassData | null>(null);

  const styles = createStyles(theme);
  const orgId = profile?.organization_id || (profile as any)?.preschool_id;

  const fetchData = useCallback(async () => {
    if (!classId || !orgId) return;

    try {
      const supabase = assertSupabase();

      // Fetch class data
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single();

      if (classError) throw classError;
      setFormData(classData);

      // Fetch available teachers
      const { data: teachersData, error: teachersError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('preschool_id', orgId)
        .ilike('role', '%teacher%');

      if (!teachersError && teachersData) {
        const transformedTeachers: Teacher[] = teachersData.map((t: any) => ({
          id: t.id,
          name: `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.email,
          email: t.email,
        }));
        setTeachers(transformedTeachers);
      }
    } catch (error: any) {
      console.error('Error fetching class:', error);
      Alert.alert('Error', 'Failed to load class information');
    } finally {
      setLoading(false);
    }
  }, [classId, orgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const navigateBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/screens/class-teacher-management');
    }
  };

  const handleSave = async () => {
    if (!formData) return;

    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Class name is required');
      return;
    }

    if (!formData.grade_level.trim()) {
      Alert.alert('Validation Error', 'Grade level is required');
      return;
    }

    setSaving(true);
    try {
      const supabase = assertSupabase();

      const { error } = await supabase
        .from('classes')
        .update({
          name: formData.name.trim(),
          grade_level: formData.grade_level.trim(),
          max_capacity: formData.max_capacity,
          room_number: formData.room_number?.trim() || null,
          teacher_id: formData.teacher_id || null,
          active: formData.active,
        })
        .eq('id', classId);

      if (error) throw error;

      Alert.alert('Success', 'Class updated successfully', [
        { text: 'OK', onPress: navigateBack },
      ]);
    } catch (error: any) {
      console.error('Error updating class:', error);
      Alert.alert('Error', 'Failed to update class');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Class',
      'Are you sure you want to delete this class? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = assertSupabase();
              const { error } = await supabase
                .from('classes')
                .delete()
                .eq('id', classId);

              if (error) throw error;

              Alert.alert('Success', 'Class deleted successfully', [
                { text: 'OK', onPress: navigateBack },
              ]);
            } catch (error: any) {
              console.error('Error deleting class:', error);
              Alert.alert('Error', 'Failed to delete class');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Edit Class', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading class information...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!formData) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Edit Class', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={48} color={theme.error} />
          <Text style={styles.errorText}>Class not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={navigateBack}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Edit Class',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={navigateBack} style={styles.headerButton}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.scrollView}>
        <View style={styles.form}>
          {/* Class Name */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Class Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="e.g., Little Explorers"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          {/* Grade Level */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Grade Level *</Text>
            <TextInput
              style={styles.input}
              value={formData.grade_level}
              onChangeText={(text) => setFormData({ ...formData, grade_level: text })}
              placeholder="e.g., Grade R, Toddlers"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          {/* Max Capacity */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Maximum Capacity</Text>
            <TextInput
              style={styles.input}
              value={String(formData.max_capacity || '')}
              onChangeText={(text) =>
                setFormData({ ...formData, max_capacity: parseInt(text) || 0 })
              }
              keyboardType="numeric"
              placeholder="e.g., 25"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          {/* Room Number */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Room Number</Text>
            <TextInput
              style={styles.input}
              value={formData.room_number || ''}
              onChangeText={(text) => setFormData({ ...formData, room_number: text })}
              placeholder="e.g., Room 101"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          {/* Assigned Teacher */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Assigned Teacher</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.teacher_id || ''}
                onValueChange={(value) =>
                  setFormData({ ...formData, teacher_id: value || null })
                }
                style={styles.picker}
              >
                <Picker.Item label="No teacher assigned" value="" />
                {teachers.map((teacher) => (
                  <Picker.Item key={teacher.id} label={teacher.name} value={teacher.id} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Active Status */}
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.label}>Class Active</Text>
              <Text style={styles.sublabel}>Inactive classes won't accept new enrollments</Text>
            </View>
            <Switch
              value={formData.active}
              onValueChange={(value) => setFormData({ ...formData, active: value })}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#fff"
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.deleteButton]}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.deleteButtonText}>Delete Class</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollView: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: theme.textSecondary,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    errorText: {
      fontSize: 18,
      color: theme.error,
      marginTop: 16,
    },
    backButton: {
      marginTop: 24,
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: theme.primary,
      borderRadius: 8,
    },
    backButtonText: {
      color: '#fff',
      fontWeight: '600',
    },
    headerButton: {
      padding: 8,
    },
    form: {
      padding: 16,
    },
    formGroup: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    sublabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    input: {
      backgroundColor: theme.card,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pickerContainer: {
      backgroundColor: theme.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    picker: {
      color: theme.text,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      marginTop: 8,
    },
    actions: {
      marginTop: 32,
      gap: 12,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      borderRadius: 8,
      gap: 8,
    },
    saveButton: {
      backgroundColor: theme.primary,
    },
    saveButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 16,
    },
    deleteButton: {
      backgroundColor: '#ef4444',
    },
    deleteButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 16,
    },
  });
