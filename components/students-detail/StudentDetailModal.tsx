/**
 * Student Detail Modal for students-detail screen.
 * Shows full student info in a modal overlay.
 */

import React from 'react';
import { View, Text, Modal, TouchableOpacity, Image, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type Student, calculateAge, getStatusColor } from '@/lib/screen-data/students-detail.types';

interface Props {
  visible: boolean;
  student: Student | null;
  canManage: boolean;
  onClose: () => void;
  onToggleStatus: (id: string, status: string) => void;
  onDelete: (id: string, name: string) => void;
  onPermanentDelete: (id: string, name: string) => void;
  theme: any;
}

export function StudentDetailModal({
  visible, student, canManage, onClose,
  onToggleStatus, onDelete, onPermanentDelete, theme,
}: Props) {
  if (!student) return null;
  const age = calculateAge(student.dateOfBirth);
  const styles = createLocalStyles(theme);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Student Details</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Profile Header */}
            <View style={styles.profileHeader}>
              <View style={styles.photoLarge}>
                {student.profilePhoto ? (
                  <Image source={{ uri: student.profilePhoto }} style={styles.photoImg} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="person" size={40} color={theme.colors.text} />
                  </View>
                )}
              </View>
              <Text style={styles.name}>{student.firstName} {student.lastName}</Text>
              <View style={[styles.badge, { backgroundColor: getStatusColor(student.status) + '20' }]}>
                <Text style={[styles.badgeText, { color: getStatusColor(student.status) }]}>
                  {student.status}
                </Text>
              </View>
            </View>

            {/* Basic Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Basic Information</Text>
              <InfoRow label="Student ID" value={student.studentId} styles={styles} />
              <InfoRow label="Grade" value={student.grade} styles={styles} />
              <InfoRow label="Age" value={`${age} years old`} styles={styles} />
              <InfoRow label="Date of Birth" value={student.dateOfBirth} styles={styles} />
              <InfoRow label="Enrollment Date" value={student.enrollmentDate} styles={styles} />
            </View>

            {/* Guardian Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Guardian Information</Text>
              <InfoRow label="Guardian" value={student.guardianName} styles={styles} />
              <InfoRow label="Phone" value={student.guardianPhone} styles={styles} />
              <InfoRow label="Email" value={student.guardianEmail} styles={styles} />
            </View>

            {/* Emergency Contact */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Emergency Contact</Text>
              <InfoRow label="Name" value={student.emergencyContact} styles={styles} />
              <InfoRow label="Phone" value={student.emergencyPhone} styles={styles} />
            </View>

            {/* Medical Info */}
            {(student.medicalConditions || student.allergies) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Medical Information</Text>
                {student.medicalConditions && (
                  <InfoRow label="Conditions" value={student.medicalConditions} styles={styles} />
                )}
                {student.allergies && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Allergies:</Text>
                    <Text style={[styles.value, { color: '#DC2626' }]}>{student.allergies}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Actions */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPrimary]}
              onPress={() => {
                onClose();
                router.push(`/screens/student-detail?id=${student.id}` as any);
              }}
            >
              <Ionicons name="open-outline" size={20} color="white" />
              <Text style={styles.actionBtnTextWhite}>Open Full Profile</Text>
            </TouchableOpacity>

            {canManage && (
              <View style={styles.actions}>
                {student.status === 'inactive' ? (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionPrimary]}
                      onPress={() => { onToggleStatus(student.id, student.status); onClose(); }}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="white" />
                      <Text style={styles.actionBtnTextWhite}>Reactivate Student</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionDanger]}
                      onPress={() => { onClose(); onPermanentDelete(student.id, `${student.firstName} ${student.lastName}`); }}
                    >
                      <Ionicons name="trash" size={20} color="white" />
                      <Text style={styles.actionBtnTextWhite}>Delete Permanently Now</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionWarning]}
                    onPress={() => { onClose(); onDelete(student.id, `${student.firstName} ${student.lastName}`); }}
                  >
                    <Ionicons name="close-circle" size={20} color="white" />
                    <Text style={styles.actionBtnTextWhite}>Remove (30-Day Recovery)</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({ label, value, styles }: { label: string; value: string; styles: any }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}:</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const createLocalStyles = (theme: any) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { backgroundColor: theme.colors.surface || '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border || '#e2e8f0' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.text },
  content: { padding: 16 },
  profileHeader: { alignItems: 'center', marginBottom: 20 },
  photoLarge: { width: 80, height: 80, borderRadius: 40, marginBottom: 12, overflow: 'hidden' },
  photoImg: { width: 80, height: 80 },
  photoPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 20, fontWeight: '600', color: theme.colors.text, marginBottom: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  section: { marginBottom: 20, padding: 12, backgroundColor: theme.colors.card || '#f8fafc', borderRadius: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.primary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { fontSize: 14, color: theme.colors.textSecondary || '#64748b', flex: 1 },
  value: { fontSize: 14, color: theme.colors.text, fontWeight: '500', flex: 1, textAlign: 'right' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, marginBottom: 8, gap: 8 },
  actionPrimary: { backgroundColor: theme.colors.primary },
  actionWarning: { backgroundColor: '#EA580C' },
  actionDanger: { backgroundColor: '#DC2626' },
  actionBtnTextWhite: { color: 'white', fontSize: 16, fontWeight: '600' },
  actions: { marginTop: 8 },
});
