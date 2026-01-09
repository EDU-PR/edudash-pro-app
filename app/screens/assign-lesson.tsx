/**
 * Assign Lesson Screen
 * 
 * Allows teachers to assign lessons to students or classes.
 * Part of the lesson delivery workflow.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { useLessonAssignment } from '@/hooks/useLessonAssignment';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  age_group: string;
  duration_minutes: number;
  status: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  grade?: string;
  class_id?: string;
}

interface ClassInfo {
  id: string;
  name: string;
  student_count?: number;
}

type AssignmentMode = 'lesson' | 'student' | 'class';

export default function AssignLessonScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ lessonId?: string; studentId?: string; classId?: string }>();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  
  const [mode, setMode] = useState<AssignmentMode>('lesson');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // Selection state
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [assignToClass, setAssignToClass] = useState(false);
  
  // Assignment options
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [notes, setNotes] = useState('');
  
  // Data
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { assignLesson, assignLessonToClass, isAssigning } = useLessonAssignment();
  
  const organizationId = profile?.organization_id || profile?.preschool_id;
  
  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      if (!organizationId) return;
      
      try {
        const supabase = assertSupabase();
        
        // Fetch active lessons
        const { data: lessonsData } = await supabase
          .from('lessons')
          .select('id, title, description, subject, age_group, duration_minutes, status')
          .eq('preschool_id', organizationId)
          .eq('status', 'active')
          .order('title');
        
        // Fetch students
        const { data: studentsData } = await supabase
          .from('students')
          .select('id, first_name, last_name, grade, class_id')
          .eq('preschool_id', organizationId)
          .eq('is_active', true)
          .order('first_name');
        
        // Fetch classes
        const { data: classesData } = await supabase
          .from('classes')
          .select('id, name')
          .eq('preschool_id', organizationId)
          .order('name');
        
        setLessons(lessonsData || []);
        setStudents(studentsData || []);
        setClasses(classesData || []);
        
        // Handle pre-selected items from params
        if (params.lessonId) {
          const lesson = lessonsData?.find(l => l.id === params.lessonId);
          if (lesson) {
            setSelectedLesson(lesson);
            setStep(2);
          }
        }
        if (params.studentId) {
          setSelectedStudents([params.studentId]);
        }
        if (params.classId) {
          const cls = classesData?.find(c => c.id === params.classId);
          if (cls) {
            setSelectedClass(cls);
            setAssignToClass(true);
          }
        }
      } catch (err) {
        console.error('[AssignLesson] Fetch error:', err);
        Alert.alert('Error', 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [organizationId, params.lessonId, params.studentId, params.classId]);
  
  const handleAssign = async () => {
    if (!selectedLesson) {
      Alert.alert('Error', 'Please select a lesson');
      return;
    }
    
    if (!assignToClass && selectedStudents.length === 0) {
      Alert.alert('Error', 'Please select at least one student');
      return;
    }
    
    if (assignToClass && !selectedClass) {
      Alert.alert('Error', 'Please select a class');
      return;
    }
    
    try {
      let success = false;
      
      if (assignToClass && selectedClass) {
        success = await assignLessonToClass(
          selectedLesson.id,
          selectedClass.id,
          {
            due_date: dueDate?.toISOString().split('T')[0],
            priority,
            notes: notes || undefined,
          }
        );
      } else {
        // Assign to each selected student
        for (const studentId of selectedStudents) {
          const result = await assignLesson({
            lesson_id: selectedLesson.id,
            student_id: studentId,
            due_date: dueDate?.toISOString().split('T')[0],
            priority,
            notes: notes || undefined,
          });
          if (result) success = true;
        }
      }
      
      if (success) {
        Alert.alert(
          'Success',
          assignToClass
            ? `Lesson assigned to ${selectedClass?.name}`
            : `Lesson assigned to ${selectedStudents.length} student(s)`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', 'Failed to assign lesson');
      }
    } catch (err) {
      console.error('[AssignLesson] Assign error:', err);
      Alert.alert('Error', 'Failed to assign lesson');
    }
  };
  
  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };
  
  const selectAllStudents = () => {
    if (selectedStudents.length === students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map(s => s.id));
    }
  };
  
  const filteredLessons = lessons.filter(l => 
    l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredStudents = students.filter(s => 
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <LinearGradient
        colors={['#8B5CF6', '#7C3AED']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Assign Lesson</Text>
            <Text style={styles.headerSubtitle}>Step {step} of 3</Text>
          </View>
        </View>
        
        {/* Progress Steps */}
        <View style={styles.progressContainer}>
          <View style={styles.progressSteps}>
            <View style={[styles.progressStep, step >= 1 && styles.progressStepActive]}>
              <Text style={styles.progressStepNumber}>1</Text>
            </View>
            <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
            <View style={[styles.progressStep, step >= 2 && styles.progressStepActive]}>
              <Text style={styles.progressStepNumber}>2</Text>
            </View>
            <View style={[styles.progressLine, step >= 3 && styles.progressLineActive]} />
            <View style={[styles.progressStep, step >= 3 && styles.progressStepActive]}>
              <Text style={styles.progressStepNumber}>3</Text>
            </View>
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>Lesson</Text>
            <Text style={styles.progressLabel}>Recipients</Text>
            <Text style={styles.progressLabel}>Confirm</Text>
          </View>
        </View>
      </LinearGradient>
      
      {/* Step 1: Select Lesson */}
      {step === 1 && (
        <View style={styles.stepContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search lessons..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          
          <FlatList
            data={filteredLessons}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.listItem,
                  selectedLesson?.id === item.id && styles.listItemSelected
                ]}
                onPress={() => setSelectedLesson(item)}
              >
                <View style={styles.listItemIcon}>
                  <Ionicons name="book" size={24} color="#8B5CF6" />
                </View>
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemTitle}>{item.title}</Text>
                  <Text style={styles.listItemSubtitle}>
                    {item.subject} • {item.duration_minutes} min • Ages {item.age_group}
                  </Text>
                </View>
                {selectedLesson?.id === item.id && (
                  <Ionicons name="checkmark-circle" size={24} color="#8B5CF6" />
                )}
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No lessons found</Text>
                <TouchableOpacity
                  style={styles.createLessonButton}
                  onPress={() => router.push('/screens/create-lesson')}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.createLessonButtonText}>Create Lesson</Text>
                </TouchableOpacity>
              </View>
            }
          />
          
          <View style={styles.stepFooter}>
            <TouchableOpacity
              style={[styles.nextButton, !selectedLesson && styles.nextButtonDisabled]}
              onPress={() => selectedLesson && setStep(2)}
              disabled={!selectedLesson}
            >
              <Text style={styles.nextButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Step 2: Select Recipients */}
      {step === 2 && (
        <View style={styles.stepContainer}>
          {/* Toggle: Class vs Students */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleOption, !assignToClass && styles.toggleOptionActive]}
              onPress={() => setAssignToClass(false)}
            >
              <Ionicons name="people" size={20} color={!assignToClass ? '#fff' : theme.textSecondary} />
              <Text style={[styles.toggleOptionText, !assignToClass && styles.toggleOptionTextActive]}>
                Individual Students
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleOption, assignToClass && styles.toggleOptionActive]}
              onPress={() => setAssignToClass(true)}
            >
              <Ionicons name="school" size={20} color={assignToClass ? '#fff' : theme.textSecondary} />
              <Text style={[styles.toggleOptionText, assignToClass && styles.toggleOptionTextActive]}>
                Entire Class
              </Text>
            </TouchableOpacity>
          </View>
          
          {!assignToClass ? (
            <>
              <View style={styles.selectAllRow}>
                <TouchableOpacity onPress={selectAllStudents}>
                  <Text style={styles.selectAllText}>
                    {selectedStudents.length === students.length ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.selectedCount}>
                  {selectedStudents.length} selected
                </Text>
              </View>
              
              <FlatList
                data={filteredStudents}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.listItem,
                      selectedStudents.includes(item.id) && styles.listItemSelected
                    ]}
                    onPress={() => toggleStudent(item.id)}
                  >
                    <View style={styles.checkboxContainer}>
                      <View style={[
                        styles.checkbox,
                        selectedStudents.includes(item.id) && styles.checkboxChecked
                      ]}>
                        {selectedStudents.includes(item.id) && (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        )}
                      </View>
                    </View>
                    <View style={styles.listItemContent}>
                      <Text style={styles.listItemTitle}>
                        {item.first_name} {item.last_name}
                      </Text>
                      {item.grade && (
                        <Text style={styles.listItemSubtitle}>Grade {item.grade}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.listContent}
              />
            </>
          ) : (
            <FlatList
              data={classes}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.listItem,
                    selectedClass?.id === item.id && styles.listItemSelected
                  ]}
                  onPress={() => setSelectedClass(item)}
                >
                  <View style={styles.listItemIcon}>
                    <Ionicons name="school" size={24} color="#8B5CF6" />
                  </View>
                  <View style={styles.listItemContent}>
                    <Text style={styles.listItemTitle}>{item.name}</Text>
                  </View>
                  {selectedClass?.id === item.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#8B5CF6" />
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.listContent}
            />
          )}
          
          <View style={styles.stepFooter}>
            <TouchableOpacity
              style={styles.backStepButton}
              onPress={() => setStep(1)}
            >
              <Ionicons name="arrow-back" size={20} color={theme.text} />
              <Text style={styles.backStepButtonText}>Back</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.nextButton,
                (assignToClass ? !selectedClass : selectedStudents.length === 0) && styles.nextButtonDisabled
              ]}
              onPress={() => setStep(3)}
              disabled={assignToClass ? !selectedClass : selectedStudents.length === 0}
            >
              <Text style={styles.nextButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Step 3: Confirm & Options */}
      {step === 3 && (
        <ScrollView style={styles.stepContainer} contentContainerStyle={styles.confirmContent}>
          {/* Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Assignment Summary</Text>
            
            <View style={styles.summaryRow}>
              <Ionicons name="book" size={20} color={theme.primary} />
              <Text style={styles.summaryLabel}>Lesson:</Text>
              <Text style={styles.summaryValue}>{selectedLesson?.title}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Ionicons name="people" size={20} color={theme.primary} />
              <Text style={styles.summaryLabel}>Recipients:</Text>
              <Text style={styles.summaryValue}>
                {assignToClass
                  ? selectedClass?.name
                  : `${selectedStudents.length} student(s)`}
              </Text>
            </View>
          </View>
          
          {/* Options */}
          <View style={styles.optionsCard}>
            <Text style={styles.optionsTitle}>Assignment Options</Text>
            
            {/* Due Date */}
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => setShowDatePicker(true)}
            >
              <View style={styles.optionLeft}>
                <Ionicons name="calendar" size={20} color={theme.textSecondary} />
                <Text style={styles.optionLabel}>Due Date</Text>
              </View>
              <Text style={styles.optionValue}>
                {dueDate ? dueDate.toLocaleDateString() : 'Not set'}
              </Text>
            </TouchableOpacity>
            
            {showDatePicker && (
              <DateTimePicker
                value={dueDate || new Date()}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setDueDate(date);
                }}
              />
            )}
            
            {/* Priority */}
            <View style={styles.priorityContainer}>
              <Text style={styles.optionLabel}>Priority</Text>
              <View style={styles.priorityOptions}>
                {(['low', 'normal', 'high', 'urgent'] as const).map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityOption,
                      priority === p && styles.priorityOptionActive
                    ]}
                    onPress={() => setPriority(p)}
                  >
                    <Text style={[
                      styles.priorityOptionText,
                      priority === p && styles.priorityOptionTextActive
                    ]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {/* Notes */}
            <View style={styles.notesContainer}>
              <Text style={styles.optionLabel}>Notes (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Add instructions or notes..."
                placeholderTextColor={theme.textSecondary}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>
          
          <View style={styles.stepFooter}>
            <TouchableOpacity
              style={styles.backStepButton}
              onPress={() => setStep(2)}
            >
              <Ionicons name="arrow-back" size={20} color={theme.text} />
              <Text style={styles.backStepButtonText}>Back</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.assignButton, isAssigning && styles.nextButtonDisabled]}
              onPress={handleAssign}
              disabled={isAssigning}
            >
              {isAssigning ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={20} color="#fff" />
                  <Text style={styles.assignButtonText}>Assign Lesson</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: theme.textSecondary,
    fontSize: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 20,
  },
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressStepActive: {
    backgroundColor: '#fff',
  },
  progressStepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  progressLine: {
    width: 60,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressLineActive: {
    backgroundColor: '#fff',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  stepContainer: {
    flex: 1,
  },
  searchInput: {
    margin: 16,
    padding: 14,
    backgroundColor: theme.card,
    borderRadius: 12,
    fontSize: 15,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 100,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.card,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  listItemSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: '#8B5CF610',
  },
  listItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8B5CF610',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  listItemSubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: theme.textSecondary,
    marginBottom: 16,
  },
  createLessonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  createLessonButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  stepFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.background,
    gap: 12,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    borderRadius: 12,
  },
  nextButtonDisabled: {
    backgroundColor: theme.border,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  backStepButtonText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '500',
  },
  toggleContainer: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 4,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  toggleOptionActive: {
    backgroundColor: '#8B5CF6',
  },
  toggleOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  toggleOptionTextActive: {
    color: '#fff',
  },
  selectAllRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  selectAllText: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  selectedCount: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  confirmContent: {
    padding: 16,
    paddingBottom: 100,
  },
  summaryCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  summaryValue: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '500',
    flex: 1,
  },
  optionsCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 20,
  },
  optionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionLabel: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '500',
    marginBottom: 8,
  },
  optionValue: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  priorityContainer: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  priorityOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  priorityOptionActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  priorityOptionText: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  priorityOptionTextActive: {
    color: '#fff',
  },
  notesContainer: {
    paddingVertical: 14,
  },
  notesInput: {
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: theme.text,
    minHeight: 80,
  },
  assignButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
  },
  assignButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
