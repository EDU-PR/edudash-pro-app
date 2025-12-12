import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import * as Clipboard from 'expo-clipboard';

export default function CreateProgramScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const orgId = profile?.organization_id || (profile as any)?.preschool_id;
  
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Form fields
  const [title, setTitle] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('beauty'); // beauty, marketing, etc.
  const [duration, setDuration] = useState('');
  const [maxStudents, setMaxStudents] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorContact, setSponsorContact] = useState('');
  const [fee, setFee] = useState('');
  const [isSponsored, setIsSponsored] = useState(false);
  const [requirements, setRequirements] = useState('');
  const [learningOutcomes, setLearningOutcomes] = useState('');

  const generateCourseCode = () => {
    // Auto-generate code based on title
    const prefix = orgId?.substring(0, 3).toUpperCase() || 'ORG';
    const code = title
      .split(' ')
      .map((word) => word.substring(0, 2).toUpperCase())
      .join('')
      .substring(0, 6);
    return `${prefix}-${code || 'COURSE'}`;
  };

  const handleGenerateCode = () => {
    if (title.trim()) {
      setCourseCode(generateCourseCode());
    } else {
      Alert.alert('Enter Title First', 'Please enter a program title to generate the code');
    }
  };

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Error', 'Program title is required');
      return;
    }

    if (!courseCode.trim()) {
      Alert.alert('Error', 'Course code is required. Click "Generate Code" or enter manually.');
      return;
    }

    setSaving(true);
    try {
      const supabase = assertSupabase();

      // Create program/course
      const { data: newProgram, error } = await supabase
        .from('courses')
        .insert({
          title: title.trim(),
          course_code: courseCode.trim().toUpperCase(),
          description: description.trim() || null,
          organization_id: orgId,
          is_active: true,
          max_students: maxStudents ? parseInt(maxStudents) : null,
          start_date: startDate || null,
          end_date: endDate || null,
          // Store additional metadata in a JSON field if available
          // Otherwise, create a separate table for sponsor info
        })
        .select('id, title, course_code')
        .single();

      if (error) throw error;

      // Store sponsor info if provided (could be in a separate table or JSON field)
      if (isSponsored && (sponsorName || sponsorContact)) {
        // TODO: Create sponsor relationship in database
        console.log('Sponsor info:', { sponsorName, sponsorContact, programId: newProgram.id });
      }

      Alert.alert(
        'Program Created!',
        `${newProgram.title} has been created successfully.`,
        [
          {
            text: 'Create Another',
            style: 'cancel',
            onPress: () => {
              // Reset form but keep some fields
              setTitle('');
              setDescription('');
              setCourseCode('');
              setDuration('');
              setMaxStudents('');
            },
          },
          {
            text: 'Share Program',
            onPress: () => {
              router.push({
                pathname: '/screens/org-admin/programs',
                params: { shareProgramId: newProgram.id },
              } as any);
            },
          },
          {
            text: 'Done',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create program');
    } finally {
      setSaving(false);
    }
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Create Program',
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
          headerTintColor: theme.primary,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Basic Information</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>
                Program Title <Text style={{ color: theme.error }}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, {
                  backgroundColor: theme.card,
                  color: theme.text,
                  borderColor: theme.border,
                }]}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., Beauty Therapy Learnership, Marketing Fundamentals"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Course Code <Text style={{ color: theme.error }}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[styles.generateButton, { backgroundColor: theme.primary + '20' }]}
                  onPress={handleGenerateCode}
                >
                  <Ionicons name="refresh" size={16} color={theme.primary} />
                  <Text style={[styles.generateButtonText, { color: theme.primary }]}>
                    Generate
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.input, {
                  backgroundColor: theme.card,
                  color: theme.text,
                  borderColor: theme.border,
                }]}
                value={courseCode}
                onChangeText={setCourseCode}
                placeholder="ORG-BEAUTY"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
                {['beauty', 'marketing', 'business', 'tech', 'healthcare', 'other'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      category === cat && { backgroundColor: theme.primary },
                      { borderColor: theme.border },
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        category === cat && { color: '#fff' },
                        { color: theme.text },
                      ]}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Description</Text>
              <TextInput
                style={[styles.textArea, {
                  backgroundColor: theme.card,
                  color: theme.text,
                  borderColor: theme.border,
                }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the program, what students will learn, career opportunities..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: theme.text }]}>Duration</Text>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: theme.border,
                  }]}
                  value={duration}
                  onChangeText={setDuration}
                  placeholder="e.g., 6 months, 12 weeks"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: theme.text }]}>Max Students</Text>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: theme.border,
                  }]}
                  value={maxStudents}
                  onChangeText={setMaxStudents}
                  placeholder="Optional"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: theme.text }]}>Start Date</Text>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: theme.border,
                  }]}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: theme.text }]}>End Date</Text>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: theme.border,
                  }]}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.advancedToggle, { borderColor: theme.border }]}
              onPress={() => setShowAdvanced(!showAdvanced)}
            >
              <Text style={[styles.advancedToggleText, { color: theme.text }]}>
                Sponsor & Additional Info
              </Text>
              <Ionicons
                name={showAdvanced ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>

            {showAdvanced && (
              <View style={styles.advancedSection}>
                <View style={styles.inputGroup}>
                  <View style={styles.switchRow}>
                    <Text style={[styles.label, { color: theme.text }]}>Sponsored Program</Text>
                    <Switch
                      value={isSponsored}
                      onValueChange={setIsSponsored}
                      trackColor={{ false: theme.border, true: theme.primary }}
                      thumbColor="#fff"
                    />
                  </View>
                </View>

                {isSponsored && (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, { color: theme.text }]}>Sponsor Name</Text>
                      <TextInput
                        style={[styles.input, {
                          backgroundColor: theme.card,
                          color: theme.text,
                          borderColor: theme.border,
                        }]}
                        value={sponsorName}
                        onChangeText={setSponsorName}
                        placeholder="Sponsor organization name"
                        placeholderTextColor={theme.textSecondary}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, { color: theme.text }]}>Sponsor Contact</Text>
                      <TextInput
                        style={[styles.input, {
                          backgroundColor: theme.card,
                          color: theme.text,
                          borderColor: theme.border,
                        }]}
                        value={sponsorContact}
                        onChangeText={setSponsorContact}
                        placeholder="Email or phone"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="email-address"
                      />
                    </View>
                  </>
                )}

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>Fee/Cost</Text>
                  <TextInput
                    style={[styles.input, {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    }]}
                    value={fee}
                    onChangeText={setFee}
                    placeholder="e.g., R5000, Free, Sponsored"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>Entry Requirements</Text>
                  <TextInput
                    style={[styles.textArea, {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    }]}
                    value={requirements}
                    onChangeText={setRequirements}
                    placeholder="Minimum education, skills, prerequisites..."
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>Learning Outcomes</Text>
                  <TextInput
                    style={[styles.textArea, {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    }]}
                    value={learningOutcomes}
                    onChangeText={setLearningOutcomes}
                    placeholder="What students will achieve upon completion..."
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={handleSave}
              disabled={saving || !title.trim() || !courseCode.trim()}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Create Program</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 20,
    paddingBottom: 40,
  },
  form: {
    gap: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 8,
  },
  inputGroup: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  generateButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  advancedToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  advancedToggleText: {
    fontSize: 15,
    fontWeight: '600',
  },
  advancedSection: {
    gap: 16,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 10,
    gap: 8,
    marginTop: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

