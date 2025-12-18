/**
 * TeacherProfileView Component
 * 
 * Displays detailed teacher profile with documents and actions.
 * Extracted from app/screens/teacher-management.tsx per WARP.md standards.
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { TeacherDocumentsService, TeacherDocument } from '@/lib/services/TeacherDocumentsService';
import type { Teacher } from '@/types/teacher-management';
import type { ThemeColors } from '@/contexts/ThemeContext';

interface TeacherProfileViewProps {
  teacher: Teacher;
  teacherDocsMap: Record<string, TeacherDocument | undefined>;
  isUploadingDoc: boolean;
  selectedTeacherHasSeat: boolean;
  shouldDisableAssignment: boolean;
  isAssigning: boolean;
  isRevoking: boolean;
  theme?: ThemeColors;
  onBack: () => void;
  onMessage: () => void;
  onAssignSeat: (teacherUserId: string, teacherName: string) => void;
  onRevokeSeat: (teacherUserId: string, teacherName: string) => void;
  onAttachDocument: () => void;
}

export function TeacherProfileView({
  teacher,
  teacherDocsMap,
  isUploadingDoc,
  selectedTeacherHasSeat,
  shouldDisableAssignment,
  isAssigning,
  isRevoking,
  theme,
  onBack,
  onMessage,
  onAssignSeat,
  onRevokeSeat,
  onAttachDocument,
}: TeacherProfileViewProps) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const fullName = `${teacher.firstName} ${teacher.lastName}`;

  const handleOpenDocument = async (docKey: string) => {
    const existing = teacherDocsMap[docKey];
    if (!existing) {
      Alert.alert('No File', 'No file is currently attached for this document.');
      return;
    }
    try {
      const url = await TeacherDocumentsService.getSignedUrl(existing.file_path);
      if (!url) {
        Alert.alert('Error', 'Failed to open document.');
        return;
      }
      // Prefer in-app browser when available
      if (WebBrowser && WebBrowser.openBrowserAsync) {
        await WebBrowser.openBrowserAsync(url);
      } else {
        await Linking.openURL(url);
      }
    } catch (_e) {
      Alert.alert('Error', 'Could not open document.');
    }
  };

  const documentItems = [
    { key: 'cv', label: 'CV', complete: !!teacher.documents.cv },
    { key: 'qualifications', label: 'Qualifications', complete: !!teacher.documents.qualifications },
    { key: 'id_copy', label: 'ID Copy', complete: !!teacher.documents.id_copy },
    { key: 'contracts', label: 'Contracts', complete: !!teacher.documents.contracts },
  ];

  const completedDocs = documentItems.filter((d) => d.complete || teacherDocsMap[d.key]).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={theme?.text || '#333'} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{fullName}</Text>
          <Text style={styles.headerSubtitle}>{teacher.email}</Text>
        </View>
      </View>

      {/* Profile Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profile</Text>
        <Text style={styles.cardText}>Phone: {teacher.phone}</Text>
        <Text style={styles.cardText}>Employee ID: {teacher.employeeId}</Text>
        <Text style={styles.cardText}>Status: {teacher.status}</Text>
        <Text style={styles.cardText}>Contract: {teacher.contractType}</Text>
        <Text style={styles.cardText}>Hire Date: {teacher.hireDate}</Text>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionButton, styles.messageButton]} onPress={onMessage}>
            <Ionicons name="chatbubbles" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>
              {selectedTeacherHasSeat ? 'Message (Has Seat)' : 'Message (No Seat)'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.seatActionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.assignButton]}
            onPress={() => onAssignSeat(teacher.teacherUserId, fullName)}
            disabled={shouldDisableAssignment || isAssigning}
          >
            <Ionicons name="add-circle" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Assign Seat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.revokeButton]}
            onPress={() => onRevokeSeat(teacher.teacherUserId, fullName)}
            disabled={isRevoking}
          >
            <Ionicons name="remove-circle" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Revoke Seat</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Documents Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderInfo}>
            <Text style={styles.cardTitle}>Documents</Text>
            <Text style={styles.cardSubtitle}>{completedDocs}/4 complete</Text>
          </View>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={onAttachDocument}
            disabled={isUploadingDoc}
          >
            <Ionicons name="cloud-upload" size={16} color="#fff" />
            <Text style={styles.attachButtonText}>{isUploadingDoc ? 'Uploading...' : 'Attach'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.documentGrid}>
          {documentItems.map((doc) => (
            <TouchableOpacity
              key={doc.key}
              style={[styles.docItem, (doc.complete || teacherDocsMap[doc.key]) && styles.docComplete]}
              onPress={() => handleOpenDocument(doc.key)}
            >
              <Ionicons
                name={doc.complete || teacherDocsMap[doc.key] ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={doc.complete || teacherDocsMap[doc.key] ? '#065f46' : '#6b7280'}
              />
              <Text
                style={[
                  styles.docText,
                  (doc.complete || teacherDocsMap[doc.key]) && styles.docCompleteText,
                ]}
              >
                {doc.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Performance Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Performance</Text>
        <View style={styles.performanceRow}>
          <Text style={styles.performanceLabel}>Rating:</Text>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>{teacher.performance.rating}/5.0</Text>
          </View>
        </View>
        <Text style={styles.cardText}>Last Review: {teacher.performance.lastReviewDate}</Text>
        {teacher.performance.strengths.length > 0 && (
          <>
            <Text style={styles.listLabel}>Strengths:</Text>
            <Text style={styles.listText}>{teacher.performance.strengths.join(', ')}</Text>
          </>
        )}
        {teacher.performance.goals.length > 0 && (
          <>
            <Text style={styles.listLabel}>Goals:</Text>
            <Text style={styles.listText}>{teacher.performance.goals.join(', ')}</Text>
          </>
        )}
      </View>

      {/* Attendance Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Attendance</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{teacher.attendance.daysPresent}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{teacher.attendance.daysAbsent}</Text>
            <Text style={styles.statLabel}>Absent</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{teacher.attendance.lateArrivals}</Text>
            <Text style={styles.statLabel}>Late</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{teacher.attendance.leaveBalance}</Text>
            <Text style={styles.statLabel}>Leave Balance</Text>
          </View>
        </View>
      </View>

      {/* Workload Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Workload</Text>
        <Text style={styles.cardText}>Teaching Hours: {teacher.workload.teachingHours}/week</Text>
        {teacher.workload.adminDuties.length > 0 && (
          <>
            <Text style={styles.listLabel}>Admin Duties:</Text>
            <Text style={styles.listText}>{teacher.workload.adminDuties.join(', ')}</Text>
          </>
        )}
        {teacher.workload.extraCurricular.length > 0 && (
          <>
            <Text style={styles.listLabel}>Extra-curricular:</Text>
            <Text style={styles.listText}>{teacher.workload.extraCurricular.join(', ')}</Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const createStyles = (theme?: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme?.background || '#f8fafc',
    },
    contentContainer: {
      paddingBottom: 100,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: theme?.surface || 'white',
      borderBottomWidth: 1,
      borderBottomColor: theme?.border || '#f3f4f6',
    },
    backButton: {
      paddingRight: 12,
      paddingVertical: 4,
    },
    headerInfo: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme?.text || '#333',
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme?.textSecondary || '#6b7280',
      marginTop: 2,
    },
    card: {
      backgroundColor: theme?.cardBackground || 'white',
      borderRadius: 16,
      padding: 20,
      marginHorizontal: 16,
      marginTop: 12,
      shadowColor: theme?.shadow || '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
      borderColor: theme?.border || '#f3f4f6',
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    cardHeaderInfo: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme?.text || '#111827',
      marginBottom: 8,
    },
    cardSubtitle: {
      fontSize: 13,
      color: theme?.textSecondary || '#6b7280',
    },
    cardText: {
      fontSize: 14,
      color: theme?.textSecondary || '#6b7280',
      marginBottom: 4,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    seatActionsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      gap: 6,
    },
    messageButton: {
      backgroundColor: '#2563eb',
    },
    assignButton: {
      backgroundColor: '#059669',
    },
    revokeButton: {
      backgroundColor: '#dc2626',
    },
    actionButtonText: {
      color: 'white',
      fontSize: 13,
      fontWeight: '700',
    },
    attachButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#2563eb',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      gap: 6,
    },
    attachButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 13,
    },
    documentGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    docItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: theme?.surfaceVariant || '#f9fafb',
      minWidth: '45%',
      flex: 1,
    },
    docComplete: {
      backgroundColor: '#d1fae5',
    },
    docText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme?.textSecondary || '#6b7280',
      marginLeft: 6,
    },
    docCompleteText: {
      color: '#065f46',
    },
    performanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    performanceLabel: {
      fontSize: 14,
      color: theme?.textSecondary || '#6b7280',
      marginRight: 8,
    },
    ratingBadge: {
      backgroundColor: theme?.primary + '15' || '#dbeafe',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    ratingText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme?.primary || '#007AFF',
    },
    listLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme?.text || '#333',
      marginTop: 8,
      marginBottom: 2,
    },
    listText: {
      fontSize: 13,
      color: theme?.textSecondary || '#6b7280',
      lineHeight: 18,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: theme?.text || '#111827',
    },
    statLabel: {
      fontSize: 11,
      color: theme?.textSecondary || '#6b7280',
      marginTop: 2,
    },
  });

export default TeacherProfileView;
