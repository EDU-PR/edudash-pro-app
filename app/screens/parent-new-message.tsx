import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useCreateThread } from '@/hooks/useParentMessaging';
import SkeletonLoader from '@/components/ui/SkeletonLoader';

interface Child {
  id: string;
  first_name: string;
  last_name: string;
  class_name?: string;
  teacher_name?: string;
  teacher_id?: string;
}

/**
 * ParentNewMessageScreen - Select a child to start a new message thread with their teacher
 */
export default function ParentNewMessageScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  
  const createThread = useCreateThread();
  
  // Fetch children linked to this parent
  const { data: children, isLoading, error } = useQuery({
    queryKey: ['parent', 'children-for-messages', user?.id],
    queryFn: async (): Promise<Child[]> => {
      if (!user?.id) return [];
      
      const client = assertSupabase();
      
      // Get students linked to this parent
      const { data, error } = await client
        .from('parent_student_links')
        .select(`
          student:students(
            id,
            first_name,
            last_name,
            class:classes(
              id,
              name,
              teacher:profiles(id, first_name, last_name)
            )
          )
        `)
        .eq('parent_id', user.id)
        .eq('status', 'approved');
      
      if (error) throw error;
      
      // Transform data
      return (data || []).map((link: any) => {
        const student = link.student;
        const classInfo = student?.class;
        const teacher = classInfo?.teacher;
        
        return {
          id: student?.id,
          first_name: student?.first_name,
          last_name: student?.last_name,
          class_name: classInfo?.name,
          teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}`.trim() : undefined,
          teacher_id: teacher?.id,
        };
      }).filter((c: any) => c.id);
    },
    enabled: !!user?.id,
  });
  
  const handleStartMessage = async () => {
    if (!selectedChildId) {
      Alert.alert(
        t('parent.selectChildFirst', { defaultValue: 'Select Child' }),
        t('parent.selectChildForMessage', { defaultValue: 'Please select a child to message their teacher.' })
      );
      return;
    }
    
    try {
      const threadId = await createThread.mutateAsync({ studentId: selectedChildId });
      
      // Get child name for the title
      const child = children?.find(c => c.id === selectedChildId);
      const title = child ? `${child.first_name} ${child.last_name}`.trim() : t('parent.messages', { defaultValue: 'Messages' });
      
      // Navigate to the thread
      router.replace(`/message-thread?threadId=${threadId}&title=${encodeURIComponent(title)}`);
    } catch (err) {
      console.error('Error creating thread:', err);
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('parent.failedToCreateThread', { defaultValue: 'Failed to start conversation. Please try again.' })
      );
    }
  };
  
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    header: {
      marginBottom: 24,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 8,
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    childCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    childCardSelected: {
      borderWidth: 2,
      borderColor: theme.primary,
      backgroundColor: theme.primary + '10',
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    avatarSelected: {
      backgroundColor: theme.primary,
    },
    childInfo: {
      flex: 1,
    },
    childName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    childMeta: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    teacherInfo: {
      fontSize: 12,
      color: theme.primary,
      marginTop: 4,
    },
    checkmark: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkmarkSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    startButton: {
      backgroundColor: theme.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 24,
    },
    startButtonDisabled: {
      opacity: 0.5,
    },
    startButtonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.error,
      marginBottom: 8,
      textAlign: 'center',
    },
    errorText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  }), [theme]);

  const insets = useSafeAreaInsets();
  
  // Simple header component
  const SimpleHeader = ({ title }: { title: string }) => (
    <View style={{
      backgroundColor: theme.surface,
      paddingTop: Platform.OS === 'ios' ? insets.top : StatusBar.currentHeight || 0,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 56,
      }}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={{ marginRight: 12 }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '600', color: theme.text }}>{title}</Text>
      </View>
    </View>
  );
  
  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <SimpleHeader title={t('parent.startNewMessage', { defaultValue: 'New Message' })} />
        <View style={styles.content}>
          <SkeletonLoader width="100%" height={80} borderRadius={12} style={{ marginBottom: 12 }} />
          <SkeletonLoader width="100%" height={80} borderRadius={12} style={{ marginBottom: 12 }} />
          <SkeletonLoader width="100%" height={80} borderRadius={12} style={{ marginBottom: 12 }} />
        </View>
      </View>
    );
  }
  
  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <SimpleHeader title={t('parent.startNewMessage', { defaultValue: 'New Message' })} />
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={48} color={theme.error} />
          <Text style={styles.errorTitle}>{t('common.error', { defaultValue: 'Error' })}</Text>
          <Text style={styles.errorText}>{t('parent.failedToLoadChildren', { defaultValue: 'Unable to load your children. Please try again.' })}</Text>
        </View>
      </View>
    );
  }
  
  // Empty state - no children linked
  if (!children || children.length === 0) {
    return (
      <View style={styles.container}>
        <SimpleHeader title={t('parent.startNewMessage', { defaultValue: 'New Message' })} />
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={64} color={theme.textSecondary} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>{t('parent.noChildrenLinked', { defaultValue: 'No Children Linked' })}</Text>
          <Text style={styles.emptyText}>
            {t('parent.linkChildToMessage', { defaultValue: 'Please link a child to your account first to message their teacher.' })}
          </Text>
        </View>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <SimpleHeader title={t('parent.startNewMessage', { defaultValue: 'New Message' })} />
      <ScrollView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {t('parent.selectChildTitle', { defaultValue: 'Select a Child' })}
          </Text>
          <Text style={styles.headerSubtitle}>
            {t('parent.selectChildSubtitle', { defaultValue: 'Choose which child you want to discuss with their teacher.' })}
          </Text>
        </View>
        
        {/* Children List */}
        {children.map((child) => (
          <TouchableOpacity
            key={child.id}
            style={[
              styles.childCard,
              selectedChildId === child.id && styles.childCardSelected
            ]}
            onPress={() => setSelectedChildId(child.id)}
          >
            <View style={[
              styles.avatar,
              selectedChildId === child.id && styles.avatarSelected
            ]}>
              <Ionicons 
                name="person" 
                size={24} 
                color={selectedChildId === child.id ? theme.onPrimary : theme.primary} 
              />
            </View>
            
            <View style={styles.childInfo}>
              <Text style={styles.childName}>
                {child.first_name} {child.last_name}
              </Text>
              {child.class_name && (
                <Text style={styles.childMeta}>
                  {t('parent.inClass', { className: child.class_name, defaultValue: `Class: ${child.class_name}` })}
                </Text>
              )}
              {child.teacher_name && (
                <Text style={styles.teacherInfo}>
                  👨‍🏫 {child.teacher_name}
                </Text>
              )}
            </View>
            
            <View style={[
              styles.checkmark,
              selectedChildId === child.id && styles.checkmarkSelected
            ]}>
              {selectedChildId === child.id && (
                <Ionicons name="checkmark" size={16} color={theme.onPrimary} />
              )}
            </View>
          </TouchableOpacity>
        ))}
        
        {/* Start Message Button */}
        <TouchableOpacity
          style={[
            styles.startButton,
            (!selectedChildId || createThread.isPending) && styles.startButtonDisabled
          ]}
          onPress={handleStartMessage}
          disabled={!selectedChildId || createThread.isPending}
        >
          {createThread.isPending ? (
            <ActivityIndicator color={theme.onPrimary} />
          ) : (
            <Text style={styles.startButtonText}>
              {t('parent.startConversation', { defaultValue: 'Start Conversation' })}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
