/**
 * Principal Messages Screen
 * Communication hub: Announcements, Direct Messages, and Calls
 * More feature-rich than the basic teacher messages screen
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { toast } from '@/components/ui/ToastProvider';
import { track } from '@/lib/analytics';

type TabType = 'broadcast' | 'direct' | 'calls';
type RecipientType = 'all_parents' | 'all_teachers' | 'all_staff' | 'class';

interface RecipientOption {
  id: RecipientType;
  label: string;
  icon: string;
  color: string;
  description: string;
}

interface ClassOption {
  id: string;
  name: string;
}

interface MessageHistory {
  id: string;
  subject: string;
  message: string;
  recipient_type: string;
  class_id: string | null;
  class_name?: string;
  sent_at: string;
  sent_count?: number;
}

const RECIPIENT_OPTIONS: RecipientOption[] = [
  { 
    id: 'all_parents', 
    label: 'All Parents', 
    icon: 'people', 
    color: '#10B981',
    description: 'Send to all parents in your school'
  },
  { 
    id: 'all_teachers', 
    label: 'All Teachers', 
    icon: 'school', 
    color: '#3B82F6',
    description: 'Send to all teachers in your school'
  },
  { 
    id: 'all_staff', 
    label: 'All Staff', 
    icon: 'briefcase', 
    color: '#8B5CF6',
    description: 'Send to teachers, admins, and staff'
  },
  { 
    id: 'class', 
    label: 'Specific Class', 
    icon: 'layers', 
    color: '#F59E0B',
    description: 'Send to parents of a specific class'
  },
];

export default function PrincipalMessagesScreen() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const organizationId = (profile as any)?.organization_id || (profile as any)?.preschool_id;

  const [recipientType, setRecipientType] = useState<RecipientType>('all_parents');
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [messageHistory, setMessageHistory] = useState<MessageHistory[]>([]);

  const [recipientCounts, setRecipientCounts] = useState({
    parents: 0,
    teachers: 0,
    staff: 0,
  });

  // Load counts and classes
  useEffect(() => {
    if (!organizationId) return;
    loadData();
  }, [organizationId]);

  const loadData = async () => {
    if (!organizationId) return;
    
    setLoadingCounts(true);
    try {
      const supabase = assertSupabase();

      // Count parents (unique guardians)
      const { count: parentCount } = await supabase
        .from('students')
        .select('guardian_id', { count: 'exact', head: true })
        .eq('preschool_id', organizationId)
        .not('guardian_id', 'is', null);

      // Count teachers
      const { count: teacherCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('preschool_id', organizationId)
        .eq('role', 'teacher');

      // Count all staff
      const { count: staffCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('preschool_id', organizationId)
        .in('role', ['teacher', 'admin', 'principal', 'assistant']);

      setRecipientCounts({
        parents: parentCount || 0,
        teachers: teacherCount || 0,
        staff: staffCount || 0,
      });

      // Load classes
      const { data: classData } = await supabase
        .from('classes')
        .select('id, name')
        .eq('preschool_id', organizationId)
        .eq('active', true)
        .order('name');

      setClasses(classData || []);

      // Load recent messages
      const { data: historyData } = await supabase
        .from('teacher_messages')
        .select('id, subject, message, class_id, sent_at, created_at, classes(name)')
        .eq('preschool_id', organizationId)
        .order('sent_at', { ascending: false })
        .limit(10);

      const mapped = (historyData || []).map((m: any) => ({
        id: m.id,
        subject: m.subject,
        message: m.message,
        recipient_type: m.class_id ? 'class' : 'all_parents',
        class_id: m.class_id,
        class_name: m.classes?.name,
        sent_at: m.sent_at || m.created_at,
      }));
      setMessageHistory(mapped);

    } catch (e: any) {
      console.error('Failed to load data:', e);
    } finally {
      setLoadingCounts(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getRecipientCount = (): number => {
    switch (recipientType) {
      case 'all_parents':
        return recipientCounts.parents;
      case 'all_teachers':
        return recipientCounts.teachers;
      case 'all_staff':
        return recipientCounts.staff;
      case 'class':
        return selectedClass ? recipientCounts.parents : 0; // Approximate
      default:
        return 0;
    }
  };

  const onSend = async () => {
    if (!organizationId) {
      toast.warn('Your account is not linked to a school.', 'Not Connected');
      return;
    }
    if (!subject.trim()) {
      toast.warn('Please enter a subject.', 'Subject Required');
      return;
    }
    if (!message.trim()) {
      toast.warn('Please write a message.', 'Message Required');
      return;
    }
    if (recipientType === 'class' && !selectedClass) {
      toast.warn('Please select a class.', 'Class Required');
      return;
    }

    setSending(true);
    try {
      const supabase = assertSupabase();
      const { data: authUser } = await supabase.auth.getUser();
      const userId = authUser?.user?.id;

      // For class-based messages, use teacher_messages table
      if (recipientType === 'class') {
        const { error } = await supabase.from('teacher_messages').insert({
          class_id: selectedClass,
          subject,
          message,
          teacher_id: userId,
          preschool_id: organizationId,
          created_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
        });
        if (error) throw error;
      } else {
        // For broader announcements, use announcements table
        const { error } = await supabase.from('announcements').insert({
          title: subject,
          content: message,
          preschool_id: organizationId,
          created_by: userId,
          target_audience: recipientType === 'all_parents' ? 'parents' 
                         : recipientType === 'all_teachers' ? 'teachers' 
                         : 'all',
          is_active: true,
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
      }

      track('edudash.principal.message_sent', { 
        recipientType, 
        classId: selectedClass,
        subjectLength: subject.length,
        messageLength: message.length 
      });

      toast.success(`Message sent to ${getRecipientCount()} recipients!`, 'Sent Successfully');
      setSubject('');
      setMessage('');
      setSelectedClass(null);
      loadData(); // Refresh history
    } catch (e: any) {
      toast.error(e?.message || 'Could not send message.', 'Failed');
    } finally {
      setSending(false);
    }
  };

  const selectedOption = RECIPIENT_OPTIONS.find(o => o.id === recipientType);

  // Quick action buttons for navigation
  const QuickActions = () => (
    <View style={styles.quickActionsRow}>
      <TouchableOpacity 
        style={[styles.quickAction, { backgroundColor: '#3B82F6' + '20', borderColor: '#3B82F6' }]}
        onPress={() => router.push('/screens/teacher-message-list')}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: '#3B82F6' }]}>
          <Ionicons name="chatbubbles" size={20} color="#fff" />
        </View>
        <Text style={[styles.quickActionLabel, { color: '#3B82F6' }]}>Direct Messages</Text>
        <Ionicons name="chevron-forward" size={16} color="#3B82F6" />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.quickAction, { backgroundColor: '#10B981' + '20', borderColor: '#10B981' }]}
        onPress={() => router.push('/screens/calls')}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: '#10B981' }]}>
          <Ionicons name="call" size={20} color="#fff" />
        </View>
        <Text style={[styles.quickActionLabel, { color: '#10B981' }]}>Voice & Video Calls</Text>
        <Ionicons name="chevron-forward" size={16} color="#10B981" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader 
        title="Communication Hub" 
        subtitle="Announcements, messages, and calls"
      />

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {!organizationId ? (
          <View style={styles.card}>
            <Ionicons name="alert-circle" size={48} color="#F59E0B" style={{ alignSelf: 'center' }} />
            <Text style={[styles.cardTitle, { textAlign: 'center', marginTop: 12 }]}>
              Not Connected to School
            </Text>
            <Text style={[styles.cardText, { textAlign: 'center' }]}>
              Your account is not linked to a school. Please contact support.
            </Text>
          </View>
        ) : (
          <>
            {/* Quick Actions - Direct Messages & Calls */}
            <QuickActions />

            {/* Recipient Stats */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: '#10B981' + '20' }]}>
                <Ionicons name="people" size={24} color="#10B981" />
                <Text style={[styles.statNumber, { color: '#10B981' }]}>
                  {loadingCounts ? '...' : recipientCounts.parents}
                </Text>
                <Text style={styles.statLabel}>Parents</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#3B82F6' + '20' }]}>
                <Ionicons name="school" size={24} color="#3B82F6" />
                <Text style={[styles.statNumber, { color: '#3B82F6' }]}>
                  {loadingCounts ? '...' : recipientCounts.teachers}
                </Text>
                <Text style={styles.statLabel}>Teachers</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#8B5CF6' + '20' }]}>
                <Ionicons name="briefcase" size={24} color="#8B5CF6" />
                <Text style={[styles.statNumber, { color: '#8B5CF6' }]}>
                  {loadingCounts ? '...' : recipientCounts.staff}
                </Text>
                <Text style={styles.statLabel}>Staff</Text>
              </View>
            </View>

            {/* Recipient Selection */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Send To</Text>
              <View style={styles.recipientGrid}>
                {RECIPIENT_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.recipientOption,
                      recipientType === option.id && { 
                        borderColor: option.color, 
                        backgroundColor: option.color + '15' 
                      }
                    ]}
                    onPress={() => {
                      setRecipientType(option.id);
                      if (option.id !== 'class') setSelectedClass(null);
                    }}
                  >
                    <View style={[styles.recipientIcon, { backgroundColor: option.color + '20' }]}>
                      <Ionicons name={option.icon as any} size={24} color={option.color} />
                    </View>
                    <Text style={[
                      styles.recipientLabel,
                      recipientType === option.id && { color: option.color }
                    ]}>
                      {option.label}
                    </Text>
                    {recipientType === option.id && (
                      <Ionicons name="checkmark-circle" size={20} color={option.color} style={styles.checkIcon} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {recipientType === 'class' && (
                <View style={styles.classSelector}>
                  <Text style={styles.label}>Select Class</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {classes.map(c => (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.classChip,
                          selectedClass === c.id && styles.classChipActive
                        ]}
                        onPress={() => setSelectedClass(c.id)}
                      >
                        <Text style={[
                          styles.classChipText,
                          selectedClass === c.id && styles.classChipTextActive
                        ]}>
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Message Composer */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Compose Message</Text>
              
              <Text style={styles.label}>Subject</Text>
              <TextInput
                style={styles.input}
                value={subject}
                onChangeText={setSubject}
                placeholder="Enter message subject..."
                placeholderTextColor={theme.textSecondary}
              />

              <Text style={[styles.label, { marginTop: 16 }]}>Message</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={message}
                onChangeText={setMessage}
                placeholder="Write your message to the school community..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              <View style={styles.sendRow}>
                <View style={styles.sendInfo}>
                  <Ionicons name="paper-plane" size={16} color={theme.textSecondary} />
                  <Text style={styles.sendInfoText}>
                    Will be sent to ~{getRecipientCount()} {selectedOption?.label.toLowerCase() || 'recipients'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                  onPress={onSend}
                  disabled={sending}
                >
                  {sending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color="#fff" />
                      <Text style={styles.sendButtonText}>Send</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Message History */}
            {messageHistory.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Recent Messages</Text>
                {messageHistory.map(m => (
                  <View key={m.id} style={styles.historyItem}>
                    <View style={styles.historyHeader}>
                      <Text style={styles.historySubject}>{m.subject}</Text>
                      <Text style={styles.historyDate}>
                        {new Date(m.sent_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={styles.historyMessage} numberOfLines={2}>
                      {m.message}
                    </Text>
                    {m.class_name && (
                      <View style={styles.historyBadge}>
                        <Ionicons name="layers" size={12} color="#F59E0B" />
                        <Text style={styles.historyBadgeText}>{m.class_name}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme?.background || '#0b1220',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: theme?.card || '#111827',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme?.border || '#1f2937',
    marginBottom: 16,
  },
  cardTitle: {
    color: theme?.text || '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  cardText: {
    color: theme?.textSecondary || '#9CA3AF',
    fontSize: 14,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  statLabel: {
    color: theme?.textSecondary || '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  recipientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  recipientOption: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme?.border || '#1f2937',
    backgroundColor: theme?.surface || '#1f2937',
  },
  recipientIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  recipientLabel: {
    flex: 1,
    color: theme?.text || '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  checkIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  classSelector: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme?.border || '#1f2937',
  },
  label: {
    color: theme?.text || '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  classChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme?.surface || '#1f2937',
    marginRight: 10,
    borderWidth: 1,
    borderColor: theme?.border || '#374151',
  },
  classChipActive: {
    backgroundColor: theme?.primary || '#00f5ff',
    borderColor: theme?.primary || '#00f5ff',
  },
  classChipText: {
    color: theme?.text || '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  classChipTextActive: {
    color: theme?.onPrimary || '#000',
  },
  input: {
    backgroundColor: theme?.surface || '#1f2937',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme?.border || '#374151',
    padding: 14,
    color: theme?.text || '#fff',
    fontSize: 15,
  },
  textArea: {
    minHeight: 120,
  },
  sendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme?.border || '#1f2937',
  },
  sendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  sendInfoText: {
    color: theme?.textSecondary || '#9CA3AF',
    fontSize: 13,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme?.primary || '#00f5ff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: theme?.onPrimary || '#000',
    fontWeight: '700',
    fontSize: 15,
  },
  historyItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#1f2937',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historySubject: {
    color: theme?.text || '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  historyDate: {
    color: theme?.textSecondary || '#9CA3AF',
    fontSize: 12,
  },
  historyMessage: {
    color: theme?.textSecondary || '#9CA3AF',
    fontSize: 13,
    lineHeight: 18,
  },
  historyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  historyBadgeText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
  },
  quickActionsRow: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 16,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quickActionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
});
