/**
 * TeacherQuickNotes Component
 * 
 * Displays quick notes/updates from teachers to parents about their child.
 * Shows daily highlights, concerns, achievements, or reminders.
 * 
 * Features:
 * - Note types with visual indicators (highlight, concern, achievement, reminder)
 * - Real-time updates
 * - Expandable note details
 * - Reply/acknowledge functionality
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { formatRelativeTime } from '@/lib/utils/dateUtils';

export interface TeacherNote {
  id: string;
  student_id: string;
  teacher_id: string;
  note_type: 'highlight' | 'concern' | 'achievement' | 'reminder' | 'general';
  title: string;
  content: string;
  is_read: boolean;
  requires_acknowledgment: boolean;
  acknowledged_at?: string;
  created_at: string;
  teacher_name?: string;
  teacher_photo?: string;
}

interface TeacherQuickNotesProps {
  studentId: string;
  maxItems?: number;
  showHeader?: boolean;
  onNotePress?: (note: TeacherNote) => void;
  onAcknowledge?: (noteId: string) => void;
}

// Note type configuration
const NOTE_TYPES = {
  highlight: { icon: 'sunny', color: '#F59E0B', label: 'Daily Highlight' },
  concern: { icon: 'alert-circle', color: '#EF4444', label: 'Please Note' },
  achievement: { icon: 'trophy', color: '#10B981', label: 'Achievement' },
  reminder: { icon: 'notifications', color: '#6366F1', label: 'Reminder' },
  general: { icon: 'chatbubble', color: '#3B82F6', label: 'Note' },
};

export function TeacherQuickNotes({
  studentId,
  maxItems = 5,
  showHeader = true,
  onNotePress,
  onAcknowledge,
}: TeacherQuickNotesProps) {
  const { theme } = useTheme();
  const [notes, setNotes] = useState<TeacherNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const styles = useMemo(() => createStyles(theme), [theme]);

  const loadNotes = useCallback(async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    try {
      const supabase = assertSupabase();
      
      // Get recent teacher notes for this student
      const { data, error } = await supabase
        .from('teacher_student_notes')
        .select(`
          *,
          profiles:teacher_id (first_name, last_name, avatar_url)
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(maxItems);

      if (error) {
        // Table might not exist yet, gracefully handle
        console.log('[TeacherQuickNotes] Notes table may not exist:', error.message);
        setNotes([]);
      } else {
        const mapped = (data || []).map((n: any) => ({
          ...n,
          teacher_name: n.profiles 
            ? `${n.profiles.first_name || ''} ${n.profiles.last_name || ''}`.trim()
            : 'Teacher',
          teacher_photo: n.profiles?.avatar_url,
        }));
        setNotes(mapped);
      }
    } catch (err) {
      console.error('[TeacherQuickNotes] Error:', err);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [studentId, maxItems]);

  useEffect(() => {
    loadNotes();

    // Real-time subscription
    if (!studentId) return;
    
    const supabase = assertSupabase();
    const subscription = supabase
      .channel(`teacher_notes_${studentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teacher_student_notes',
          filter: `student_id=eq.${studentId}`,
        },
        () => {
          loadNotes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [studentId, loadNotes]);

  const handleAcknowledge = async (noteId: string) => {
    try {
      const supabase = assertSupabase();
      await supabase
        .from('teacher_student_notes')
        .update({ 
          acknowledged_at: new Date().toISOString(),
          is_read: true,
        })
        .eq('id', noteId);
      
      loadNotes();
      onAcknowledge?.(noteId);
    } catch (err) {
      console.error('[TeacherQuickNotes] Acknowledge error:', err);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const renderNote = ({ item }: { item: TeacherNote }) => {
    const noteConfig = NOTE_TYPES[item.note_type] || NOTE_TYPES.general;
    const isExpanded = expandedId === item.id;
    const isUnread = !item.is_read;

    return (
      <TouchableOpacity
        style={[
          styles.noteItem,
          { backgroundColor: isUnread ? `${noteConfig.color}10` : theme.background },
          { borderLeftColor: noteConfig.color },
        ]}
        onPress={() => {
          toggleExpand(item.id);
          onNotePress?.(item);
        }}
        activeOpacity={0.7}
      >
        {/* Note header */}
        <View style={styles.noteHeader}>
          <View style={[styles.noteTypeIcon, { backgroundColor: `${noteConfig.color}20` }]}>
            <Ionicons name={noteConfig.icon as any} size={16} color={noteConfig.color} />
          </View>
          <View style={styles.noteHeaderText}>
            <Text style={[styles.noteTypeLabel, { color: noteConfig.color }]}>
              {noteConfig.label}
            </Text>
            <Text style={[styles.noteTime, { color: theme.textTertiary }]}>
              {formatRelativeTime(item.created_at)}
            </Text>
          </View>
          {isUnread && (
            <View style={[styles.unreadDot, { backgroundColor: noteConfig.color }]} />
          )}
        </View>

        {/* Note content */}
        <Text style={[styles.noteTitle, { color: theme.text }]}>
          {item.title}
        </Text>
        <Text 
          style={[styles.noteContent, { color: theme.textSecondary }]}
          numberOfLines={isExpanded ? undefined : 2}
        >
          {item.content}
        </Text>

        {/* Expanded details */}
        {isExpanded && (
          <View style={styles.expandedSection}>
            {item.teacher_name && (
              <Text style={[styles.teacherInfo, { color: theme.textTertiary }]}>
                From: {item.teacher_name}
              </Text>
            )}

            {item.requires_acknowledgment && !item.acknowledged_at && (
              <TouchableOpacity
                style={[styles.acknowledgeButton, { backgroundColor: theme.primary }]}
                onPress={() => handleAcknowledge(item.id)}
              >
                <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                <Text style={styles.acknowledgeText}>Acknowledge</Text>
              </TouchableOpacity>
            )}

            {item.acknowledged_at && (
              <View style={styles.acknowledgedBadge}>
                <Ionicons name="checkmark-done" size={14} color={theme.success} />
                <Text style={[styles.acknowledgedText, { color: theme.success }]}>
                  Acknowledged
                </Text>
              </View>
            )}
          </View>
        )}

        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.textSecondary}
          style={styles.expandIcon}
        />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    );
  }

  // Don't render anything if no notes (to keep dashboard clean)
  if (notes.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="chatbubbles" size={20} color={theme.primary} />
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              From Teacher
            </Text>
          </View>
          {notes.filter(n => !n.is_read).length > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
              <Text style={styles.unreadCount}>
                {notes.filter(n => !n.is_read).length} new
              </Text>
            </View>
          )}
        </View>
      )}

      <FlatList
        data={notes}
        renderItem={renderNote}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
    },
    unreadBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    unreadCount: {
      color: '#FFF',
      fontSize: 12,
      fontWeight: '600',
    },
    noteItem: {
      padding: 14,
      borderRadius: 12,
      borderLeftWidth: 4,
      position: 'relative',
    },
    noteHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    noteTypeIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    noteHeaderText: {
      marginLeft: 10,
      flex: 1,
    },
    noteTypeLabel: {
      fontSize: 12,
      fontWeight: '600',
    },
    noteTime: {
      fontSize: 11,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    noteTitle: {
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 4,
    },
    noteContent: {
      fontSize: 14,
      lineHeight: 20,
    },
    expandedSection: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: 'rgba(128, 128, 128, 0.2)',
    },
    teacherInfo: {
      fontSize: 12,
      marginBottom: 10,
    },
    acknowledgeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      gap: 6,
    },
    acknowledgeText: {
      color: '#FFF',
      fontSize: 14,
      fontWeight: '600',
    },
    acknowledgedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    acknowledgedText: {
      fontSize: 12,
      fontWeight: '500',
    },
    expandIcon: {
      position: 'absolute',
      right: 14,
      top: 14,
    },
  });

export default TeacherQuickNotes;
