// Detail modal for reviewing a specific report

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { ApprovalStatusBadge } from '@/components/progress-report/ApprovalStatusBadge';
import { SignatureDisplay } from '@/components/progress-report/SignatureDisplay';
import type { ProgressReport } from './types';

interface ReviewDetailModalProps {
  report: ProgressReport | null;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  theme: any;
}

export function ReviewDetailModal({ report, onClose, onApprove, onReject, theme }: ReviewDetailModalProps) {
  if (!report) return null;

  const styles = createStyles(theme);

  return (
    <Modal
      visible={!!report}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Review Report</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeButtonText, { color: theme.primary }]}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Student: {report.student_name}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              Teacher: {report.teacher_name}
            </Text>
            <ApprovalStatusBadge status={report.status} />
          </View>

          {report.teacher_signature_data && report.teacher_signed_at && (
            <View style={styles.section}>
              <SignatureDisplay
                signatureData={report.teacher_signature_data}
                signerName={report.teacher_name || 'Teacher'}
                signerRole="teacher"
                signedAt={report.teacher_signed_at}
              />
            </View>
          )}

          <View style={styles.actionButtons}>
            <TouchableOpacity
              onPress={onReject}
              style={[styles.button, styles.rejectButton, { borderColor: theme.error }]}
            >
              <Text style={[styles.buttonText, { color: theme.error }]}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onApprove}
              style={[styles.button, styles.approveButton, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Approve & Sign</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    modalContainer: {
      flex: 1,
    },
    modalScroll: {
      flex: 1,
    },
    modalContent: {
      padding: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      fontSize: 16,
      fontWeight: '500',
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 4,
    },
    sectionSubtitle: {
      fontSize: 14,
      marginBottom: 12,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
    },
    button: {
      flex: 1,
      height: 48,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
    },
    rejectButton: {
      backgroundColor: 'transparent',
    },
    approveButton: {},
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
  });
