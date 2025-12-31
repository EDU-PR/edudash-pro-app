/**
 * Governance Screen
 * Organizational governance, policies, and compliance
 */
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';
import { assertSupabase } from '@/lib/supabase';
import * as DocumentPicker from 'expo-document-picker';

interface BoardMember {
  id: string;
  name: string;
  role: string;
  since: string;
  photo?: string;
}

interface Policy {
  id: string;
  title: string;
  category: string;
  lastUpdated: string;
  status: 'active' | 'under-review' | 'draft';
}

interface Meeting {
  id: string;
  title: string;
  type: 'board' | 'agm' | 'committee';
  date: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  attendees: number;
}

const BOARD_MEMBERS: BoardMember[] = [
  { id: '1', name: 'King Bongani Ramontja', role: 'President & Chairperson', since: '2020' },
  { id: '2', name: 'Position Vacant', role: 'Vice Chairperson', since: '-' },
  { id: '3', name: 'Position Vacant', role: 'Secretary', since: '-' },
  { id: '4', name: 'Position Vacant', role: 'Treasurer', since: '-' },
  { id: '5', name: 'Position Vacant', role: 'Board Member', since: '-' },
];

// Youth Wing Board positions
const YOUTH_BOARD_MEMBERS: BoardMember[] = [
  { id: 'y1', name: 'Position Vacant', role: 'Youth President', since: '-' },
  { id: 'y2', name: 'Position Vacant', role: 'Youth Deputy President', since: '-' },
  { id: 'y3', name: 'Position Vacant', role: 'Youth Secretary', since: '-' },
  { id: 'y4', name: 'Position Vacant', role: 'Youth Treasurer', since: '-' },
  { id: 'y5', name: 'Position Vacant', role: 'Youth Coordinator', since: '-' },
];

const POLICIES: Policy[] = [
  { id: '1', title: 'Constitution', category: 'Foundational', lastUpdated: '2024-06-15', status: 'active' },
  { id: '2', title: 'Membership Policy', category: 'Membership', lastUpdated: '2024-08-20', status: 'active' },
  { id: '3', title: 'Financial Policy', category: 'Finance', lastUpdated: '2024-09-10', status: 'active' },
  { id: '4', title: 'Code of Conduct', category: 'Ethics', lastUpdated: '2024-07-05', status: 'active' },
  { id: '5', title: 'Data Protection Policy', category: 'Privacy', lastUpdated: '2024-10-01', status: 'under-review' },
  { id: '6', title: 'Conflict of Interest Policy', category: 'Ethics', lastUpdated: '2024-05-20', status: 'active' },
];

const UPCOMING_MEETINGS: Meeting[] = [
  { id: '1', title: 'Q1 Board Meeting', type: 'board', date: '2025-01-15', status: 'scheduled', attendees: 5 },
  { id: '2', title: 'Finance Committee', type: 'committee', date: '2025-01-08', status: 'scheduled', attendees: 3 },
  { id: '3', title: 'Annual General Meeting', type: 'agm', date: '2025-03-20', status: 'scheduled', attendees: 50 },
];

export default function GovernanceScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'board' | 'policies' | 'meetings'>('board');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newDocument, setNewDocument] = useState({
    name: '',
    description: '',
    category: 'general',
    file: null as DocumentPicker.DocumentPickerAsset | null,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handlePolicyPress = (policy: Policy) => {
    // Navigate to document viewer with policy details
    router.push({
      pathname: '/screens/membership/document-viewer',
      params: {
        documentId: policy.id,
        title: policy.title,
        category: policy.category,
      },
    });
  };

  const handleAddDocument = async () => {
    setShowUploadModal(true);
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        setNewDocument(prev => ({ ...prev, file: result.assets[0] }));
      }
    } catch (err) {
      console.error('Error picking document:', err);
      Alert.alert('Error', 'Failed to select document');
    }
  };

  const handleUploadDocument = async () => {
    if (!newDocument.name.trim()) {
      Alert.alert('Error', 'Please enter a document name');
      return;
    }
    if (!newDocument.file) {
      Alert.alert('Error', 'Please select a file');
      return;
    }

    setUploading(true);
    try {
      const supabase = assertSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to upload documents');
        return;
      }

      // Get user's organization
      const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!member?.organization_id) {
        Alert.alert('Error', 'You must be part of an organization to upload documents');
        return;
      }

      // Upload file to storage
      const fileExt = newDocument.file.name.split('.').pop();
      const filePath = `${member.organization_id}/documents/${Date.now()}.${fileExt}`;
      
      const response = await fetch(newDocument.file.uri);
      const blob = await response.blob();
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('organization-documents')
        .upload(filePath, blob, {
          contentType: newDocument.file.mimeType || 'application/octet-stream',
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('organization-documents')
        .getPublicUrl(filePath);

      // Create document record
      const { error: docError } = await supabase
        .from('organization_documents')
        .insert({
          organization_id: member.organization_id,
          name: newDocument.name,
          description: newDocument.description,
          document_type: newDocument.category,
          file_url: urlData.publicUrl,
          file_name: newDocument.file.name,
          file_size: newDocument.file.size,
          mime_type: newDocument.file.mimeType || 'application/octet-stream',
          storage_path: filePath,
          uploaded_by: user.id,
          access_level: 'members',
        });

      if (docError) throw docError;

      Alert.alert('Success', 'Document uploaded successfully');
      setShowUploadModal(false);
      setNewDocument({ name: '', description: '', category: 'general', file: null });
      onRefresh();
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert('Error', 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const getMeetingTypeColor = (type: string) => {
    switch (type) {
      case 'board': return '#3B82F6';
      case 'agm': return '#8B5CF6';
      case 'committee': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10B981';
      case 'under-review': return '#F59E0B';
      case 'draft': return '#6B7280';
      default: return '#6B7280';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <DashboardWallpaperBackground>
      {/* Custom Header */}
      <View style={[styles.customHeader, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Governance</Text>
        </View>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="document-text-outline" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'board' && { backgroundColor: theme.primary + '20' }]}
          onPress={() => setActiveTab('board')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'board' ? theme.primary : theme.textSecondary }]}>
            Board
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'policies' && { backgroundColor: theme.primary + '20' }]}
          onPress={() => setActiveTab('policies')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'policies' ? theme.primary : theme.textSecondary }]}>
            Policies
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'meetings' && { backgroundColor: theme.primary + '20' }]}
          onPress={() => setActiveTab('meetings')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'meetings' ? theme.primary : theme.textSecondary }]}>
            Meetings
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {activeTab === 'board' && (
          <>
            {/* Compliance Summary */}
            <LinearGradient
              colors={['#06B6D4', '#0891B2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.complianceCard}
            >
              <View style={styles.complianceHeader}>
                <Ionicons name="shield-checkmark" size={32} color="#FFFFFF" />
                <Text style={styles.complianceTitle}>Governance Score</Text>
              </View>
              <Text style={styles.complianceScore}>72%</Text>
              <Text style={styles.complianceSubtitle}>Good Standing</Text>
              <View style={styles.complianceStats}>
                <View style={styles.complianceStat}>
                  <Text style={styles.complianceStatValue}>1/5</Text>
                  <Text style={styles.complianceStatLabel}>Board Filled</Text>
                </View>
                <View style={styles.complianceStat}>
                  <Text style={styles.complianceStatValue}>6</Text>
                  <Text style={styles.complianceStatLabel}>Active Policies</Text>
                </View>
                <View style={styles.complianceStat}>
                  <Text style={styles.complianceStatValue}>3</Text>
                  <Text style={styles.complianceStatLabel}>Upcoming Meetings</Text>
                </View>
              </View>
            </LinearGradient>

            {/* Board Members */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Board of Directors</Text>
              {BOARD_MEMBERS.map((member) => (
                <View key={member.id} style={[styles.boardCard, { backgroundColor: theme.card }]}>
                  <View style={[styles.boardAvatar, { backgroundColor: member.name.includes('Vacant') ? theme.border : theme.primary + '20' }]}>
                    {member.name.includes('Vacant') ? (
                      <Ionicons name="person-add-outline" size={24} color={theme.textSecondary} />
                    ) : (
                      <Text style={[styles.boardAvatarText, { color: theme.primary }]}>
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </Text>
                    )}
                  </View>
                  <View style={styles.boardInfo}>
                    <Text style={[styles.boardName, { color: member.name.includes('Vacant') ? theme.textSecondary : theme.text }]}>
                      {member.name}
                    </Text>
                    <Text style={[styles.boardRole, { color: theme.textSecondary }]}>{member.role}</Text>
                    {!member.name.includes('Vacant') && (
                      <Text style={[styles.boardSince, { color: theme.textSecondary }]}>Since {member.since}</Text>
                    )}
                  </View>
                  {member.name.includes('Vacant') && (
                    <TouchableOpacity style={[styles.appointButton, { borderColor: theme.primary }]}>
                      <Text style={[styles.appointButtonText, { color: theme.primary }]}>Appoint</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>

            {/* Youth Wing Board */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Youth Wing Leadership</Text>
              {YOUTH_BOARD_MEMBERS.map((member) => (
                <View key={member.id} style={[styles.boardCard, { backgroundColor: theme.card }]}>
                  <View style={[styles.boardAvatar, { backgroundColor: member.name.includes('Vacant') ? theme.border : '#8B5CF6' + '20' }]}>
                    {member.name.includes('Vacant') ? (
                      <Ionicons name="person-add-outline" size={24} color={theme.textSecondary} />
                    ) : (
                      <Text style={[styles.boardAvatarText, { color: '#8B5CF6' }]}>
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </Text>
                    )}
                  </View>
                  <View style={styles.boardInfo}>
                    <Text style={[styles.boardName, { color: member.name.includes('Vacant') ? theme.textSecondary : theme.text }]}>
                      {member.name}
                    </Text>
                    <Text style={[styles.boardRole, { color: theme.textSecondary }]}>{member.role}</Text>
                    {!member.name.includes('Vacant') && (
                      <Text style={[styles.boardSince, { color: theme.textSecondary }]}>Since {member.since}</Text>
                    )}
                  </View>
                  {member.name.includes('Vacant') && (
                    <TouchableOpacity style={[styles.appointButton, { borderColor: '#8B5CF6' }]}>
                      <Text style={[styles.appointButtonText, { color: '#8B5CF6' }]}>Appoint</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {activeTab === 'policies' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Policies & Documents</Text>
              <TouchableOpacity onPress={handleAddDocument}>
                <Ionicons name="add-circle" size={24} color={theme.primary} />
              </TouchableOpacity>
            </View>
            {POLICIES.map((policy) => (
              <TouchableOpacity 
                key={policy.id} 
                style={[styles.policyCard, { backgroundColor: theme.card }]}
                onPress={() => handlePolicyPress(policy)}
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
                <View style={[styles.policyStatus, { backgroundColor: getStatusColor(policy.status) + '20' }]}>
                  <Text style={[styles.policyStatusText, { color: getStatusColor(policy.status) }]}>
                    {policy.status === 'under-review' ? 'Review' : policy.status}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'meetings' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Upcoming Meetings</Text>
              <TouchableOpacity>
                <Ionicons name="add-circle" size={24} color={theme.primary} />
              </TouchableOpacity>
            </View>
            {UPCOMING_MEETINGS.map((meeting) => (
              <TouchableOpacity key={meeting.id} style={[styles.meetingCard, { backgroundColor: theme.card }]}>
                <View style={[styles.meetingType, { backgroundColor: getMeetingTypeColor(meeting.type) }]}>
                  <Ionicons 
                    name={meeting.type === 'board' ? 'people' : meeting.type === 'agm' ? 'megaphone' : 'chatbubbles'} 
                    size={20} 
                    color="#FFFFFF" 
                  />
                </View>
                <View style={styles.meetingInfo}>
                  <Text style={[styles.meetingTitle, { color: theme.text }]}>{meeting.title}</Text>
                  <View style={styles.meetingMeta}>
                    <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
                    <Text style={[styles.meetingMetaText, { color: theme.textSecondary }]}>
                      {new Date(meeting.date).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </Text>
                    <Ionicons name="people-outline" size={14} color={theme.textSecondary} style={{ marginLeft: 12 }} />
                    <Text style={[styles.meetingMetaText, { color: theme.textSecondary }]}>
                      {meeting.attendees} expected
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
      </DashboardWallpaperBackground>

      {/* Upload Document Modal */}
      <Modal
        visible={showUploadModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUploadModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Upload Document</Text>
              <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Document Name"
              placeholderTextColor={theme.textSecondary}
              value={newDocument.name}
              onChangeText={(text) => setNewDocument(prev => ({ ...prev, name: text }))}
            />

            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Description (optional)"
              placeholderTextColor={theme.textSecondary}
              value={newDocument.description}
              onChangeText={(text) => setNewDocument(prev => ({ ...prev, description: text }))}
              multiline
              numberOfLines={3}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Category</Text>
            <View style={styles.categoryButtons}>
              {['policy', 'governance', 'financial', 'legal', 'general'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    { borderColor: theme.border },
                    newDocument.category === cat && { backgroundColor: theme.primary + '20', borderColor: theme.primary }
                  ]}
                  onPress={() => setNewDocument(prev => ({ ...prev, category: cat }))}
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
              onPress={handlePickDocument}
            >
              <Ionicons name="document-attach" size={24} color={theme.primary} />
              <Text style={[styles.filePickerText, { color: theme.text }]}>
                {newDocument.file ? newDocument.file.name : 'Select File (PDF, DOC)'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: theme.border }]}
                onPress={() => setShowUploadModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.uploadButton, { backgroundColor: theme.primary }]}
                onPress={handleUploadDocument}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Custom Header
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerButton: {
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  complianceCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  complianceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  complianceTitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  complianceScore: {
    fontSize: 56,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  complianceSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 20,
  },
  complianceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  complianceStat: {
    alignItems: 'center',
  },
  complianceStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  complianceStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
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
    marginBottom: 16,
  },
  boardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  boardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  boardAvatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  boardInfo: {
    flex: 1,
  },
  boardName: {
    fontSize: 15,
    fontWeight: '600',
  },
  boardRole: {
    fontSize: 13,
    marginTop: 2,
  },
  boardSince: {
    fontSize: 11,
    marginTop: 2,
  },
  appointButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  appointButtonText: {
    fontSize: 12,
    fontWeight: '600',
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
  meetingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  meetingType: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  meetingInfo: {
    flex: 1,
  },
  meetingTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  meetingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  meetingMetaText: {
    fontSize: 12,
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
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
