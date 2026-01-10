/**
 * Create Youth Program Screen
 * Allows Youth President and delegated office bearers to create programs
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';
import { useQueryClient } from '@tanstack/react-query';

const PROGRAM_CATEGORIES = [
  'Leadership',
  'Education',
  'Community',
  'Sports',
  'Culture',
  'Technology',
  'Entrepreneurship',
  'Health & Wellness',
  'Arts',
  'General',
];

export default function CreateYouthProgramScreen() {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;
  const userId = user?.id;

  // Check if user has permission to create programs
  // Youth President, Deputy, Secretary, and Treasurer can create programs
  const memberType = (profile as any)?.organization_membership?.member_type;
  const canCreatePrograms = 
    memberType === 'youth_president' ||
    memberType === 'youth_deputy' ||
    memberType === 'youth_secretary' ||
    memberType === 'youth_treasurer';

  useEffect(() => {
    if (!canCreatePrograms && profile) {
      Alert.alert(
        'Access Restricted',
        'Only Youth President and delegated office bearers can create programs.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  }, [canCreatePrograms, profile]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [saving, setSaving] = useState(false);

  const generateCourseCode = () => {
    const prefix = 'YP';
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${year}-${random}`;
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Program title is required');
      return;
    }

    if (!orgId || !userId) {
      Alert.alert('Error', 'Organization or user information missing');
      return;
    }

    setSaving(true);
    try {
      const supabase = assertSupabase();
      const courseCode = generateCourseCode();

      // Create program as a course
      const { data: newProgram, error } = await supabase
        .from('courses')
        .insert({
          title: title.trim(),
          course_code: courseCode,
          description: description.trim() || null,
          organization_id: orgId,
          instructor_id: userId,
          is_active: true, // Start as active
          max_students: maxParticipants ? parseInt(maxParticipants) : null,
          start_date: startDate || null,
          end_date: endDate || null,
          metadata: {
            category,
            budget: budget ? parseFloat(budget) : null,
            program_type: 'youth_program',
            created_by_role: profile?.role || 'youth_president',
          },
        })
        .select('id, title, course_code')
        .single();

      if (error) throw error;

      // Invalidate queries to refresh programs list
      queryClient.invalidateQueries({ queryKey: ['youth-programs'] });

      Alert.alert(
        'Program Created!',
        `${newProgram.title} has been created successfully.\n\nCourse Code: ${newProgram.course_code}`,
        [
          {
            text: 'Create Another',
            style: 'cancel',
            onPress: () => {
              // Reset form
              setTitle('');
              setDescription('');
              setCategory('General');
              setStartDate('');
              setEndDate('');
              setBudget('');
              setMaxParticipants('');
            },
          },
          {
            text: 'View Programs',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error creating program:', error);
      Alert.alert('Error', error.message || 'Failed to create program');
    } finally {
      setSaving(false);
    }
  };

  if (!canCreatePrograms) {
    return null; // Will redirect via useEffect
  }

  return (
    <DashboardWallpaperBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Create Youth Program',
            headerStyle: { backgroundColor: theme.surface },
            headerTintColor: theme.text,
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
            ),
          }}
        />

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Program Title *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., Youth Leadership Summit 2025"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Description</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the program objectives and activities..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {PROGRAM_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: category === cat ? '#10B981' : theme.card,
                        borderColor: category === cat ? '#10B981' : theme.border,
                      },
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.categoryText, { color: category === cat ? '#fff' : theme.text }]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.row}>
              <View style={[styles.field, styles.halfField]}>
                <Text style={[styles.label, { color: theme.text }]}>Start Date</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={[styles.field, styles.halfField]}>
                <Text style={[styles.label, { color: theme.text }]}>End Date</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.field, styles.halfField]}>
                <Text style={[styles.label, { color: theme.text }]}>Budget (R)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={budget}
                  onChangeText={setBudget}
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.field, styles.halfField]}>
                <Text style={[styles.label, { color: theme.text }]}>Max Participants</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={maxParticipants}
                  onChangeText={setMaxParticipants}
                  placeholder="Unlimited"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: '#10B981' }]}
              onPress={handleCreate}
              disabled={saving || !title.trim()}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.createButtonText}>Create Program</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </DashboardWallpaperBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  form: {
    gap: 20,
  },
  field: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
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
  categoryScroll: {
    marginTop: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
