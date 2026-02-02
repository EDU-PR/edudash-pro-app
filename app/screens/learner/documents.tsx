/**
 * Learner Documents Hub Screen
 * 
 * Central hub for managing all learner documents:
 * - CV/Resume
 * - Certificates
 * - SARS Tax Documents
 * - ID Documents
 * - Bank Confirmation Letters
 * - Qualifications
 * - Other supporting documents
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';

// Document category definitions
const DOCUMENT_CATEGORIES = [
  {
    id: 'cv',
    icon: 'briefcase-outline',
    titleKey: 'learner.documents_cv',
    defaultTitle: 'CV / Resume',
    descKey: 'learner.documents_cv_desc',
    defaultDesc: 'Your professional resume',
    route: '/screens/learner/cv',
    color: '#3B82F6', // blue
  },
  {
    id: 'certificates',
    icon: 'ribbon-outline',
    titleKey: 'learner.documents_certificates',
    defaultTitle: 'Certificates',
    descKey: 'learner.documents_certificates_desc',
    defaultDesc: 'Course completions & achievements',
    route: '/screens/learner/documents/certificates',
    color: '#10B981', // green
  },
  {
    id: 'qualifications',
    icon: 'school-outline',
    titleKey: 'learner.documents_qualifications',
    defaultTitle: 'Qualifications',
    descKey: 'learner.documents_qualifications_desc',
    defaultDesc: 'Degrees, diplomas & matric',
    route: '/screens/learner/documents/qualifications',
    color: '#8B5CF6', // purple
  },
  {
    id: 'id_documents',
    icon: 'card-outline',
    titleKey: 'learner.documents_id',
    defaultTitle: 'ID Documents',
    descKey: 'learner.documents_id_desc',
    defaultDesc: 'ID, passport, driver\'s license',
    route: '/screens/learner/documents/id',
    color: '#F59E0B', // amber
  },
  {
    id: 'tax',
    icon: 'receipt-outline',
    titleKey: 'learner.documents_tax',
    defaultTitle: 'Tax Documents',
    descKey: 'learner.documents_tax_desc',
    defaultDesc: 'SARS registration & tax number',
    route: '/screens/learner/documents/tax',
    color: '#EF4444', // red
  },
  {
    id: 'banking',
    icon: 'wallet-outline',
    titleKey: 'learner.documents_banking',
    defaultTitle: 'Banking Details',
    descKey: 'learner.documents_banking_desc',
    defaultDesc: 'Bank confirmation letters',
    route: '/screens/learner/documents/banking',
    color: '#06B6D4', // cyan
  },
  {
    id: 'other',
    icon: 'folder-outline',
    titleKey: 'learner.documents_other',
    defaultTitle: 'Other Documents',
    descKey: 'learner.documents_other_desc',
    defaultDesc: 'References, proof of address, etc',
    route: '/screens/learner/documents/other',
    color: '#6B7280', // gray
  },
];

export default function LearnerDocumentsScreen() {
  const { profile } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: t('learner.documents', { defaultValue: 'My Documents' }),
          headerBackTitle: t('common.back', { defaultValue: 'Back' }),
        }} 
      />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header Info */}
        <Card padding={16} margin={0} style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle-outline" size={24} color={theme.primary} />
            <Text style={styles.infoTitle}>
              {t('learner.documents_info_title', { defaultValue: 'Document Storage' })}
            </Text>
          </View>
          <Text style={styles.infoText}>
            {t('learner.documents_info_desc', { 
              defaultValue: 'Securely store and manage your important documents. Upload your CV, certificates, ID documents, tax information, and more. Your documents are encrypted and only visible to you unless you choose to share them.'
            })}
          </Text>
        </Card>

        {/* Document Categories Grid */}
        <Text style={styles.sectionTitle}>
          {t('learner.document_categories', { defaultValue: 'Document Categories' })}
        </Text>
        
        <View style={styles.categoriesGrid}>
          {DOCUMENT_CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={styles.categoryCard}
              onPress={() => router.push(category.route as any)}
              activeOpacity={0.7}
            >
              <Card padding={16} margin={0} style={styles.categoryCardInner}>
                <View style={[styles.iconContainer, { backgroundColor: `${category.color}20` }]}>
                  <Ionicons name={category.icon as any} size={28} color={category.color} />
                </View>
                <Text style={styles.categoryTitle}>
                  {t(category.titleKey, { defaultValue: category.defaultTitle })}
                </Text>
                <Text style={styles.categoryDesc} numberOfLines={2}>
                  {t(category.descKey, { defaultValue: category.defaultDesc })}
                </Text>
                <View style={styles.categoryArrow}>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Tips */}
        <Card padding={16} margin={0} style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>
            {t('learner.document_tips_title', { defaultValue: 'Tips' })}
          </Text>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={18} color={theme.success || '#10B981'} />
            <Text style={styles.tipText}>
              {t('learner.document_tip_1', { defaultValue: 'Keep your CV updated regularly' })}
            </Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={18} color={theme.success || '#10B981'} />
            <Text style={styles.tipText}>
              {t('learner.document_tip_2', { defaultValue: 'Upload clear, legible scans of documents' })}
            </Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={18} color={theme.success || '#10B981'} />
            <Text style={styles.tipText}>
              {t('learner.document_tip_3', { defaultValue: 'Check expiry dates on IDs and licenses' })}
            </Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme?.background || '#0b1220',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  infoCard: {
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme?.text || '#fff',
  },
  infoText: {
    fontSize: 14,
    color: theme?.textSecondary || '#9CA3AF',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme?.text || '#fff',
    marginTop: 8,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: '48%',
    minWidth: 150,
  },
  categoryCardInner: {
    height: 140,
    position: 'relative',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme?.text || '#fff',
    marginBottom: 4,
  },
  categoryDesc: {
    fontSize: 12,
    color: theme?.textSecondary || '#9CA3AF',
    lineHeight: 16,
  },
  categoryArrow: {
    position: 'absolute',
    top: 16,
    right: 8,
  },
  tipsCard: {
    marginTop: 8,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme?.text || '#fff',
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: theme?.textSecondary || '#9CA3AF',
    flex: 1,
  },
});
