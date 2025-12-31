/**
 * Governance Policies Tab Components
 * Policy list and document management
 */
import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

export interface Policy {
  id: string;
  title: string;
  category: string;
  lastUpdated: string;
  status: 'active' | 'under-review' | 'draft';
}

// Legacy mock data removed - now using real documents from database via useOrganizationDocuments hook

export function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return '#10B981';
    case 'under-review': return '#F59E0B';
    case 'draft': return '#6B7280';
    default: return '#6B7280';
  }
}

interface PolicyCardProps {
  policy: Policy;
  theme: any;
  onPress: (policy: Policy) => void;
}

export function PolicyCard({ policy, theme, onPress }: PolicyCardProps) {
  const statusColor = getStatusColor(policy.status);
  
  return (
    <TouchableOpacity 
      style={[styles.policyCard, { backgroundColor: theme.card }]}
      onPress={() => onPress(policy)}
      activeOpacity={0.7}
    >
      <View style={styles.policyIcon}>
        <Ionicons name="document-text-outline" size={24} color={theme.primary} />
      </View>
      <View style={styles.policyInfo}>
        <Text style={[styles.policyTitle, { color: theme.text }]}>{policy.title}</Text>
        <Text style={[styles.policyMeta, { color: theme.textSecondary }]}>
          {policy.category} • Updated {new Date(policy.lastUpdated).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}
        </Text>
      </View>
      <View style={[styles.policyStatus, { backgroundColor: statusColor + '20' }]}>
        <Text style={[styles.policyStatusText, { color: statusColor }]}>
          {policy.status === 'under-review' ? 'Review' : policy.status}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} style={{ marginLeft: 8 }} />
    </TouchableOpacity>
  );
}

interface PoliciesSectionProps {
  policies: Policy[];
  theme: any;
  onPolicyPress: (policy: Policy) => void;
  onAddPress: () => void;
  loading?: boolean;
}

export function PoliciesSection({ policies, theme, onPolicyPress, onAddPress, loading }: PoliciesSectionProps) {
  if (loading) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Policies & Documents</Text>
          <TouchableOpacity onPress={onAddPress}>
            <Ionicons name="add-circle" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
        <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
            Loading documents...
          </Text>
        </View>
      </View>
    );
  }

  if (policies.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Policies & Documents</Text>
          <TouchableOpacity onPress={onAddPress}>
            <Ionicons name="add-circle" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
        <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
          <Ionicons name="document-text-outline" size={48} color={theme.textSecondary} />
          <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No Documents Yet</Text>
          <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
            Organization policies and documents will appear here once uploaded.
          </Text>
          <TouchableOpacity 
            style={[styles.uploadButton, { backgroundColor: theme.primary }]}
            onPress={onAddPress}
          >
            <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" />
            <Text style={styles.uploadButtonText}>Upload Document</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Policies & Documents</Text>
        <TouchableOpacity onPress={onAddPress}>
          <Ionicons name="add-circle" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>
      {policies.map((policy) => (
        <PolicyCard
          key={policy.id}
          policy={policy}
          theme={theme}
          onPress={onPolicyPress}
        />
      ))}
    </View>
  );
}

// Remove mock data - now using real documents from database
export const POLICIES: Policy[] = [];

interface DocumentUploadModalProps {
  visible: boolean;
  theme: any;
  uploading: boolean;
  newDocument: {
    name: string;
    description: string;
    category: string;
    file: DocumentPicker.DocumentPickerAsset | null;
  };
  onClose: () => void;
  onUpdateDocument: (updates: Partial<DocumentUploadModalProps['newDocument']>) => void;
  onPickDocument: () => void;
  onUpload: () => void;
}

export function DocumentUploadModal({
  visible,
  theme,
  uploading,
  newDocument,
  onClose,
  onUpdateDocument,
  onPickDocument,
  onUpload,
}: DocumentUploadModalProps) {
  const categories = ['policy', 'governance', 'financial', 'legal', 'general'];
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Upload Document</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            placeholder="Document Name"
            placeholderTextColor={theme.textSecondary}
            value={newDocument.name}
            onChangeText={(text) => onUpdateDocument({ name: text })}
          />

          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            placeholder="Description (optional)"
            placeholderTextColor={theme.textSecondary}
            value={newDocument.description}
            onChangeText={(text) => onUpdateDocument({ description: text })}
            multiline
            numberOfLines={3}
          />

          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Category</Text>
          <View style={styles.categoryButtons}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryButton,
                  { borderColor: theme.border },
                  newDocument.category === cat && { backgroundColor: theme.primary + '20', borderColor: theme.primary }
                ]}
                onPress={() => onUpdateDocument({ category: cat })}
              >
                <Text style={[
                  styles.categoryButtonText,
                  { color: newDocument.category === cat ? theme.primary : theme.textSecondary }
                ]}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.filePickerButton, { borderColor: theme.border, backgroundColor: theme.background }]}
            onPress={onPickDocument}
          >
            <Ionicons name="document-attach" size={24} color={theme.primary} />
            <Text style={[styles.filePickerText, { color: theme.text }]}>
              {newDocument.file ? newDocument.file.name : 'Select File (PDF, DOC)'}
            </Text>
          </TouchableOpacity>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: theme.border }]}
              onPress={onClose}
            >
              <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.uploadButton, { backgroundColor: theme.primary }]}
              onPress={onUpload}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.uploadButtonText}>Upload</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  policyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  policyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  policyInfo: {
    flex: 1,
  },
  policyTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  policyMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  policyStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  policyStatusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  filePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 24,
  },
  filePickerText: {
    fontSize: 14,
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  uploadButton: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Empty state styles
  emptyState: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
