/**
 * Document Viewer Screen
 * View, read, and share organizational documents and policies
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
  Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import { documentViewerStyles as styles } from './document-viewer.styles';

interface DocumentData {
  id: string;
  name: string;
  description?: string;
  document_type: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type: string;
  version: number;
  access_level: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  uploaded_by: string;
  uploader_name?: string;
}

export default function DocumentViewerScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ documentId: string; title?: string; category?: string }>();
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (params.documentId) {
      fetchDocument();
    } else {
      // If no documentId, this might be a mock/static document
      setDocument({
        id: 'mock',
        name: params.title || 'Document',
        description: `${params.category || 'General'} document`,
        document_type: params.category?.toLowerCase() || 'general',
        file_url: '',
        file_name: `${params.title || 'document'}.pdf`,
        mime_type: 'application/pdf',
        version: 1,
        access_level: 'members',
        tags: [params.category || 'General'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        uploaded_by: '',
      });
      setLoading(false);
    }
  }, [params.documentId]);

  const fetchDocument = async () => {
    try {
      setLoading(true);
      const supabase = assertSupabase();
      
      const { data, error: fetchError } = await supabase
        .from('organization_documents')
        .select(`
          *,
          profiles:uploaded_by(full_name)
        `)
        .eq('id', params.documentId)
        .single();

      if (fetchError) throw fetchError;
      
      setDocument({
        ...data,
        uploader_name: data.profiles?.full_name,
      });
    } catch (err) {
      console.error('Error fetching document:', err);
      setError('Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDocument = async () => {
    if (!document?.file_url) {
      Alert.alert('Coming Soon', 'Document viewing will be available once documents are uploaded to the system.');
      return;
    }

    try {
      if (Platform.OS === 'web') {
        window.open(document.file_url, '_blank');
      } else {
        await WebBrowser.openBrowserAsync(document.file_url);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to open document');
    }
  };

  const handleDownload = async () => {
    if (!document?.file_url) {
      Alert.alert('Coming Soon', 'Document download will be available once documents are uploaded to the system.');
      return;
    }

    try {
      setDownloading(true);
      
      if (Platform.OS === 'web') {
        // On web, just open the URL in new tab to download
        window.open(document.file_url, '_blank');
      } else {
        // On mobile, open in browser for download
        await WebBrowser.openBrowserAsync(document.file_url);
      }
    } catch (err) {
      console.error('Download error:', err);
      Alert.alert('Error', 'Failed to download document');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!document) return;

    try {
      const shareContent = {
        title: document.name,
        message: `Check out this document: ${document.name}\n\n${document.description || ''}`,
        url: document.file_url || undefined,
      };

      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share(shareContent);
        } else {
          // Fallback: copy to clipboard
          await navigator.clipboard.writeText(`${document.name}\n${document.description || ''}`);
          Alert.alert('Copied', 'Document info copied to clipboard');
        }
      } else {
        await Share.share(shareContent);
      }
    } catch (err) {
      if ((err as Error).message !== 'Share canceled') {
        console.error('Share error:', err);
      }
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'policy': return 'document-text';
      case 'legal': return 'briefcase';
      case 'financial': return 'cash';
      case 'governance': return 'shield-checkmark';
      case 'template': return 'copy';
      case 'certificate': return 'ribbon';
      default: return 'document';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading document...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !document) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.text }]}>{error || 'Document not found'}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {document.name}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={22} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Document Preview Card */}
        <View style={[styles.previewCard, { backgroundColor: theme.card }]}>
          <View style={[styles.iconContainer, { backgroundColor: theme.primary + '15' }]}>
            <Ionicons 
              name={getDocumentIcon(document.document_type) as any} 
              size={48} 
              color={theme.primary} 
            />
          </View>
          <Text style={[styles.documentTitle, { color: theme.text }]}>{document.name}</Text>
          <Text style={[styles.documentType, { color: theme.textSecondary }]}>
            {document.document_type.charAt(0).toUpperCase() + document.document_type.slice(1)} Document
          </Text>
          
          {/* Tags */}
          {document.tags && document.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {document.tags.map((tag, index) => (
                <View key={index} style={[styles.tag, { backgroundColor: theme.primary + '20' }]}>
                  <Text style={[styles.tagText, { color: theme.primary }]}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Description */}
        {document.description && (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Description</Text>
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              {document.description}
            </Text>
          </View>
        )}

        {/* Document Info */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Document Information</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="document-outline" size={20} color={theme.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>File Name</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{document.file_name}</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="resize-outline" size={20} color={theme.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>File Size</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{formatFileSize(document.file_size)}</Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="git-branch-outline" size={20} color={theme.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Version</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>v{document.version}</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={20} color={theme.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Last Updated</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{formatDate(document.updated_at)}</Text>
              </View>
            </View>
          </View>

          {document.uploader_name && (
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="person-outline" size={20} color={theme.textSecondary} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Uploaded By</Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>{document.uploader_name}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={handleOpenDocument}
          >
            <Ionicons name="eye-outline" size={22} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>View Document</Text>
          </TouchableOpacity>

          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton, { borderColor: theme.primary }]}
              onPress={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons name="download-outline" size={22} color={theme.primary} />
              )}
              <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
                {downloading ? 'Downloading...' : 'Download'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton, { borderColor: theme.primary }]}
              onPress={handleShare}
            >
              <Ionicons name="share-social-outline" size={22} color={theme.primary} />
              <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
