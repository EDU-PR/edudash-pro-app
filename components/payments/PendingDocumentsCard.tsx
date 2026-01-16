/**
 * PendingDocumentsCard Component
 * 
 * Shows parents their pending document upload status
 * and provides a link to upload required documents.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface PendingDocument {
  type: string;
  label: string;
  uploaded: boolean;
}

interface PendingDocumentsCardProps {
  documents?: PendingDocument[];
  registrationId?: string;
  studentId?: string;
  theme: any;
}

export function PendingDocumentsCard({
  documents,
  registrationId,
  studentId,
  theme,
}: PendingDocumentsCardProps) {
  const router = useRouter();
  const styles = createStyles(theme);

  // Default documents if none provided
  const defaultDocs: PendingDocument[] = documents || [
    { type: 'birth_certificate', label: 'Birth Certificate', uploaded: false },
    { type: 'clinic_card', label: 'Clinic Card', uploaded: false },
    { type: 'guardian_id', label: 'Guardian ID', uploaded: false },
  ];

  const pendingCount = defaultDocs.filter(d => !d.uploaded).length;
  const uploadedCount = defaultDocs.filter(d => d.uploaded).length;

  // All documents uploaded
  if (pendingCount === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: '#10B98120' }]}>
            <Ionicons name="documents" size={20} color="#10B981" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Documents Complete</Text>
            <Text style={styles.subtitle}>All required documents uploaded</Text>
          </View>
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: '/screens/parent-document-upload',
          params: { registrationId, studentId },
        })
      }
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: theme.warning + '20' }]}>
          <Ionicons name="documents" size={20} color={theme.warning} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Pending Documents</Text>
          <Text style={styles.subtitle}>
            {pendingCount} of {defaultDocs.length} documents required
          </Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendingCount}</Text>
        </View>
      </View>

      {/* Document list */}
      <View style={styles.documentList}>
        {defaultDocs.map((doc, index) => (
          <View key={doc.type} style={styles.documentItem}>
            <Ionicons
              name={doc.uploaded ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={doc.uploaded ? '#10B981' : theme.textSecondary}
            />
            <Text
              style={[
                styles.documentLabel,
                doc.uploaded && styles.documentLabelUploaded,
              ]}
            >
              {doc.label}
            </Text>
            {!doc.uploaded && (
              <Text style={styles.pendingTag}>Pending</Text>
            )}
          </View>
        ))}
      </View>

      {/* Action hint */}
      <View style={styles.actionHint}>
        <Text style={styles.actionText}>Tap to upload documents</Text>
        <Ionicons name="chevron-forward" size={16} color={theme.primary} />
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerText: {
      flex: 1,
      marginLeft: 12,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    subtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    badge: {
      backgroundColor: theme.warning,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
    documentList: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    documentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
    },
    documentLabel: {
      flex: 1,
      marginLeft: 10,
      fontSize: 14,
      color: theme.text,
    },
    documentLabelUploaded: {
      color: theme.textSecondary,
      textDecorationLine: 'line-through',
    },
    pendingTag: {
      fontSize: 11,
      color: theme.warning,
      fontWeight: '600',
      backgroundColor: theme.warning + '15',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    actionHint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    actionText: {
      fontSize: 13,
      color: theme.primary,
      fontWeight: '500',
      marginRight: 4,
    },
  });

export default PendingDocumentsCard;
