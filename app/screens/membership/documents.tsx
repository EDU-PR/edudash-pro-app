/**
 * Document Vault Screen
 * Secure document management for President/Secretary General
 * Features: Upload, folders, access control, audit trail
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { assertSupabase } from '@/lib/supabase';
import OrganizationDocumentService, {
  type DocumentFolder,
  type OrganizationDocument,
  type DocumentType,
  type AccessLevel,
} from '@/lib/services/organizationDocumentService';

// ============================================================================
// CONSTANTS
// ============================================================================

const DOCUMENT_TYPES: { value: DocumentType; label: string; icon: string; color: string }[] = [
  { value: 'policy', label: 'Policy', icon: 'document-text', color: '#3B82F6' },
  { value: 'legal', label: 'Legal', icon: 'shield-checkmark', color: '#8B5CF6' },
  { value: 'financial', label: 'Financial', icon: 'cash', color: '#10B981' },
  { value: 'governance', label: 'Governance', icon: 'business', color: '#F59E0B' },
  { value: 'disciplinary', label: 'Disciplinary', icon: 'warning', color: '#EF4444' },
  { value: 'template', label: 'Template', icon: 'copy', color: '#06B6D4' },
  { value: 'certificate', label: 'Certificate', icon: 'ribbon', color: '#EC4899' },
  { value: 'confidential', label: 'Confidential', icon: 'lock-closed', color: '#6B7280' },
];

const ACCESS_LEVELS: { value: AccessLevel; label: string; description: string }[] = [
  { value: 'admin_only', label: 'Admin Only', description: 'Only President & Secretary General' },
  { value: 'executives', label: 'Executives', description: 'National leadership team' },
  { value: 'managers', label: 'Managers', description: 'Regional & branch managers' },
  { value: 'members', label: 'All Members', description: 'Any active member' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function DocumentVaultScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [documents, setDocuments] = useState<OrganizationDocument[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([{ id: null, name: 'Root' }]);

  // Modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadType, setUploadType] = useState<DocumentType>('general');
  const [uploadAccessLevel, setUploadAccessLevel] = useState<AccessLevel>('admin_only');
  const [uploadEncrypt, setUploadEncrypt] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

  // Fetch organization ID
  useEffect(() => {
    const fetchOrgId = async () => {
      if (!user?.id) return;
      try {
        const { data: member } = await assertSupabase()
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('membership_status', 'active')
          .maybeSingle();
        if (member?.organization_id) {
          setOrganizationId(member.organization_id);
        }
      } catch (error) {
        console.error('[DocVault] Error fetching org ID:', error);
      }
    };
    fetchOrgId();
  }, [user?.id]);

  // Load data
  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const [foldersResult, docsResult] = await Promise.all([
        OrganizationDocumentService.getFolders(organizationId, currentFolderId),
        OrganizationDocumentService.getDocuments(organizationId, { folderId: currentFolderId }),
      ]);
      
      if (foldersResult.success) setFolders(foldersResult.data || []);
      if (docsResult.success) setDocuments(docsResult.data || []);
    } catch (error) {
      console.error('[DocVault] Load error:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId, currentFolderId]);

  useEffect(() => {
    if (organizationId) loadData();
  }, [organizationId, currentFolderId, loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Navigate to folder
  const navigateToFolder = (folder: DocumentFolder) => {
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
  };

  // Navigate back
  const navigateBack = (index: number) => {
    const newPath = folderPath.slice(0, index + 1);
    setFolderPath(newPath);
    setCurrentFolderId(newPath[newPath.length - 1].id);
  };

  // Pick file
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.oasis.opendocument.text', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedFile(result.assets[0]);
        setUploadName(result.assets[0].name.replace(/\.[^/.]+$/, ''));
        setShowUploadModal(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  // Upload document
  const handleUpload = async () => {
    if (!selectedFile || !organizationId || !user?.id) return;
    if (!uploadName.trim()) {
      Alert.alert('Error', 'Please enter a document name');
      return;
    }

    setUploading(true);
    try {
      const result = await OrganizationDocumentService.uploadDocument(
        organizationId,
        user.id,
        selectedFile.uri,
        selectedFile.name,
        selectedFile.mimeType || 'application/octet-stream',
        {
          name: uploadName.trim(),
          description: uploadDescription.trim() || undefined,
          folder_id: currentFolderId,
          document_type: uploadType,
          access_level: uploadAccessLevel,
          encrypt: uploadEncrypt,
        }
      );

      if (result.success) {
        Alert.alert('Success', 'Document uploaded successfully');
        setShowUploadModal(false);
        resetUploadForm();
        loadData();
      } else {
        Alert.alert('Error', result.error || 'Failed to upload document');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setUploading(false);
    }
  };

  // Create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !organizationId || !user?.id) return;

    try {
      const result = await OrganizationDocumentService.createFolder(
        organizationId,
        user.id,
        {
          name: newFolderName.trim(),
          parent_folder_id: currentFolderId,
        }
      );

      if (result.success) {
        Alert.alert('Success', 'Folder created');
        setShowNewFolderModal(false);
        setNewFolderName('');
        loadData();
      } else {
        Alert.alert('Error', result.error || 'Failed to create folder');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  // Open document
  const handleOpenDocument = async (doc: OrganizationDocument) => {
    try {
      const result = await OrganizationDocumentService.downloadDocument(doc.id);
      if (result.success && result.url) {
        await Linking.openURL(result.url);
      } else {
        Alert.alert('Error', result.error || 'Cannot open document');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open document');
    }
  };

  // Delete document
  const handleDeleteDocument = (doc: OrganizationDocument) => {
    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete "${doc.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            const result = await OrganizationDocumentService.deleteDocument(doc.id, user.id);
            if (result.success) {
              loadData();
            } else {
              Alert.alert('Error', result.error || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const resetUploadForm = () => {
    setSelectedFile(null);
    setUploadName('');
    setUploadDescription('');
    setUploadType('general');
    setUploadAccessLevel('admin_only');
    setUploadEncrypt(false);
  };

  const getDocTypeConfig = (type: DocumentType) => {
    return DOCUMENT_TYPES.find(t => t.value === type) || DOCUMENT_TYPES[0];
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Render folder item
  const renderFolder = (folder: DocumentFolder) => (
    <TouchableOpacity
      key={folder.id}
      style={[styles.folderItem, { backgroundColor: theme.card }]}
      onPress={() => navigateToFolder(folder)}
    >
      <View style={[styles.folderIcon, { backgroundColor: folder.color + '20' }]}>
        <Ionicons name={folder.icon as any} size={24} color={folder.color} />
      </View>
      <View style={styles.folderInfo}>
        <Text style={[styles.folderName, { color: theme.text }]}>{folder.name}</Text>
        {folder.description && (
          <Text style={[styles.folderDesc, { color: theme.textSecondary }]} numberOfLines={1}>
            {folder.description}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
    </TouchableOpacity>
  );

  // Render document item
  const renderDocument = (doc: OrganizationDocument) => {
    const typeConfig = getDocTypeConfig(doc.document_type);
    return (
      <TouchableOpacity
        key={doc.id}
        style={[styles.documentItem, { backgroundColor: theme.card }]}
        onPress={() => handleOpenDocument(doc)}
        onLongPress={() => handleDeleteDocument(doc)}
      >
        <View style={[styles.docIcon, { backgroundColor: typeConfig.color + '20' }]}>
          <Ionicons name={typeConfig.icon as any} size={24} color={typeConfig.color} />
          {doc.is_encrypted && (
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={10} color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.docInfo}>
          <Text style={[styles.docName, { color: theme.text }]} numberOfLines={1}>
            {doc.name}
          </Text>
          <View style={styles.docMeta}>
            <Text style={[styles.docMetaText, { color: theme.textSecondary }]}>
              {typeConfig.label}
            </Text>
            <Text style={[styles.docMetaText, { color: theme.textSecondary }]}>
              •
            </Text>
            <Text style={[styles.docMetaText, { color: theme.textSecondary }]}>
              {formatFileSize(doc.file_size)}
            </Text>
            <Text style={[styles.docMetaText, { color: theme.textSecondary }]}>
              •
            </Text>
            <Text style={[styles.docMetaText, { color: theme.textSecondary }]}>
              {formatDate(doc.created_at)}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.moreButton} onPress={() => handleDeleteDocument(doc)}>
          <Ionicons name="ellipsis-vertical" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Document Vault</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Secure organization documents
          </Text>
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={pickFile}>
          <Ionicons name="cloud-upload" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Breadcrumb */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={[styles.breadcrumb, { backgroundColor: theme.surface }]}
        contentContainerStyle={styles.breadcrumbContent}
      >
        {folderPath.map((item, index) => (
          <TouchableOpacity
            key={item.id || 'root'}
            style={styles.breadcrumbItem}
            onPress={() => navigateBack(index)}
          >
            {index > 0 && <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />}
            <Text 
              style={[
                styles.breadcrumbText, 
                { color: index === folderPath.length - 1 ? theme.primary : theme.textSecondary }
              ]}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Actions */}
      <View style={[styles.actions, { backgroundColor: theme.background }]}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primary + '15' }]}
          onPress={() => setShowNewFolderModal(true)}
        >
          <Ionicons name="folder-open" size={18} color={theme.primary} />
          <Text style={[styles.actionText, { color: theme.primary }]}>New Folder</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
          onPress={pickFile}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={[styles.actionText, { color: '#fff' }]}>Upload Document</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
        ) : (
          <>
            {/* Folders */}
            {folders.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Folders</Text>
                {folders.map(renderFolder)}
              </View>
            )}

            {/* Documents */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Documents</Text>
              {documents.length === 0 ? (
                <Card margin={0}>
                  <View style={styles.emptyState}>
                    <Ionicons name="document-outline" size={48} color={theme.textSecondary} />
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      No documents in this folder
                    </Text>
                    <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                      Tap "Upload Document" to add files
                    </Text>
                  </View>
                </Card>
              ) : (
                documents.map(renderDocument)
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Upload Modal */}
      <Modal visible={showUploadModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Upload Document</Text>
              <TouchableOpacity onPress={() => { setShowUploadModal(false); resetUploadForm(); }}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* File info */}
              {selectedFile && (
                <View style={[styles.filePreview, { backgroundColor: theme.surface }]}>
                  <Ionicons name="document" size={32} color={theme.primary} />
                  <View style={styles.filePreviewInfo}>
                    <Text style={[styles.filePreviewName, { color: theme.text }]} numberOfLines={1}>
                      {selectedFile.name}
                    </Text>
                    <Text style={[styles.filePreviewSize, { color: theme.textSecondary }]}>
                      {formatFileSize(selectedFile.size || null)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Name */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Document Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  value={uploadName}
                  onChangeText={setUploadName}
                  placeholder="Enter document name"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Description (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  value={uploadDescription}
                  onChangeText={setUploadDescription}
                  placeholder="Brief description..."
                  placeholderTextColor={theme.textSecondary}
                  multiline
                />
              </View>

              {/* Document Type */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Document Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.typeRow}>
                    {DOCUMENT_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type.value}
                        style={[
                          styles.typeButton,
                          { borderColor: theme.border },
                          uploadType === type.value && { backgroundColor: type.color + '20', borderColor: type.color },
                        ]}
                        onPress={() => setUploadType(type.value)}
                      >
                        <Ionicons
                          name={type.icon as any}
                          size={16}
                          color={uploadType === type.value ? type.color : theme.textSecondary}
                        />
                        <Text style={[styles.typeLabel, { color: uploadType === type.value ? type.color : theme.textSecondary }]}>
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Access Level */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Access Level</Text>
                {ACCESS_LEVELS.map((level) => (
                  <TouchableOpacity
                    key={level.value}
                    style={[
                      styles.accessOption,
                      { borderColor: theme.border },
                      uploadAccessLevel === level.value && { backgroundColor: theme.primary + '10', borderColor: theme.primary },
                    ]}
                    onPress={() => setUploadAccessLevel(level.value)}
                  >
                    <View style={styles.accessRadio}>
                      <View style={[
                        styles.radioOuter,
                        { borderColor: uploadAccessLevel === level.value ? theme.primary : theme.border }
                      ]}>
                        {uploadAccessLevel === level.value && (
                          <View style={[styles.radioInner, { backgroundColor: theme.primary }]} />
                        )}
                      </View>
                    </View>
                    <View style={styles.accessInfo}>
                      <Text style={[styles.accessLabel, { color: theme.text }]}>{level.label}</Text>
                      <Text style={[styles.accessDesc, { color: theme.textSecondary }]}>{level.description}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Encrypt toggle */}
              <TouchableOpacity
                style={[styles.encryptOption, { backgroundColor: uploadEncrypt ? '#EF4444' + '20' : theme.surface }]}
                onPress={() => setUploadEncrypt(!uploadEncrypt)}
              >
                <Ionicons name={uploadEncrypt ? 'lock-closed' : 'lock-open'} size={20} color={uploadEncrypt ? '#EF4444' : theme.textSecondary} />
                <View style={styles.encryptInfo}>
                  <Text style={[styles.encryptLabel, { color: theme.text }]}>Encrypt Document</Text>
                  <Text style={[styles.encryptDesc, { color: theme.textSecondary }]}>
                    Adds extra security layer
                  </Text>
                </View>
                <Ionicons 
                  name={uploadEncrypt ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={24} 
                  color={uploadEncrypt ? '#EF4444' : theme.textSecondary} 
                />
              </TouchableOpacity>
            </ScrollView>

            {/* Upload button */}
            <TouchableOpacity
              style={[styles.uploadButton, { backgroundColor: theme.primary }]}
              onPress={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={20} color="#fff" />
                  <Text style={styles.uploadButtonText}>Upload Document</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* New Folder Modal */}
      <Modal visible={showNewFolderModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, styles.smallModal, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>New Folder</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border, marginVertical: 16 }]}
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Folder name"
              placeholderTextColor={theme.textSecondary}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.surface }]}
                onPress={() => { setShowNewFolderModal(false); setNewFolderName(''); }}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={handleCreateFolder}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8, marginRight: 8 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSubtitle: { fontSize: 13 },
  headerButton: { padding: 8 },
  breadcrumb: { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  breadcrumbContent: { alignItems: 'center', paddingHorizontal: 16 },
  breadcrumbItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  breadcrumbText: { fontSize: 14, marginLeft: 4 },
  actions: { flexDirection: 'row', padding: 16, gap: 12 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, gap: 8 },
  actionText: { fontSize: 14, fontWeight: '600' },
  content: { padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  loader: { marginTop: 32 },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySubtext: { fontSize: 14, marginTop: 4 },
  folderItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 8 },
  folderIcon: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  folderInfo: { flex: 1, marginLeft: 12 },
  folderName: { fontSize: 15, fontWeight: '600' },
  folderDesc: { fontSize: 13, marginTop: 2 },
  documentItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 8 },
  docIcon: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  lockBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#EF4444', borderRadius: 8, padding: 2 },
  docInfo: { flex: 1, marginLeft: 12 },
  docName: { fontSize: 15, fontWeight: '600' },
  docMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  docMetaText: { fontSize: 12 },
  moreButton: { padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  smallModal: { justifyContent: 'center', margin: 20, borderRadius: 16, maxHeight: undefined },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalContent: { maxHeight: 400 },
  filePreview: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 16 },
  filePreviewInfo: { flex: 1, marginLeft: 12 },
  filePreviewName: { fontSize: 14, fontWeight: '600' },
  filePreviewSize: { fontSize: 12, marginTop: 2 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input: { height: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  textArea: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderRadius: 20, gap: 6 },
  typeLabel: { fontSize: 13, fontWeight: '500' },
  accessOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderRadius: 10, marginBottom: 8 },
  accessRadio: { marginRight: 12 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  accessInfo: { flex: 1 },
  accessLabel: { fontSize: 14, fontWeight: '600' },
  accessDesc: { fontSize: 12, marginTop: 2 },
  encryptOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, marginTop: 8, marginBottom: 16 },
  encryptInfo: { flex: 1, marginLeft: 12 },
  encryptLabel: { fontSize: 14, fontWeight: '600' },
  encryptDesc: { fontSize: 12, marginTop: 2 },
  uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8, marginTop: 8 },
  uploadButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalButtonText: { fontSize: 15, fontWeight: '600' },
});
