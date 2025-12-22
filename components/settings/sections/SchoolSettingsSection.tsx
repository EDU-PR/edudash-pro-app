import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ViewStyle, TextStyle } from 'react-native';
import type { SchoolSettings } from '@/lib/services/SchoolSettingsService';

interface SchoolSettingsSectionProps {
  schoolSettingsQuery: UseQueryResult<SchoolSettings, Error>;
  isVisible: boolean;
  styles: {
    section: ViewStyle;
    sectionTitle: TextStyle;
    settingsCard: ViewStyle;
    settingItem: ViewStyle;
    lastSettingItem: ViewStyle;
    settingLeft: ViewStyle;
    settingIcon: ViewStyle;
    settingContent: ViewStyle;
    settingTitle: TextStyle;
    settingSubtitle: TextStyle;
    settingRight: ViewStyle;
  };
}

export function SchoolSettingsSection({ 
  schoolSettingsQuery, 
  isVisible,
  styles 
}: SchoolSettingsSectionProps) {
  const { theme } = useTheme();
  const { t } = useTranslation('common');

  if (!isVisible) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('settings.schoolOverview')}</Text>
      
      {/* Loading state */}
      {schoolSettingsQuery.isLoading && (
        <View style={styles.settingsCard}>
          <View style={[styles.settingItem, { justifyContent: 'center', paddingVertical: 24 }]}>
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.settingSubtitle, { marginTop: 8, textAlign: 'center' }]}>
              {t('settings.loadingSchoolSettings')}
            </Text>
          </View>
        </View>
      )}
      
      {/* Settings snapshot */}
      {!schoolSettingsQuery.isLoading && schoolSettingsQuery.data && (
      <View style={styles.settingsCard}>
        {/* School Name */}
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="business" size={24} color={theme.primary} style={styles.settingIcon} />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{t('settings.schoolName')}</Text>
              <Text style={styles.settingSubtitle}>
                {schoolSettingsQuery.data.schoolName || t('dashboard.your_school')}
              </Text>
            </View>
          </View>
        </View>
        
        {/* Regional Settings */}
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="globe" size={24} color={theme.textSecondary} style={styles.settingIcon} />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{t('settings.regionalSettings')}</Text>
              <Text style={styles.settingSubtitle}>
                {schoolSettingsQuery.data.timezone || '—'} • {schoolSettingsQuery.data.currency || '—'}
              </Text>
            </View>
          </View>
        </View>
        
        {/* WhatsApp Integration */}
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons 
              name="logo-whatsapp" 
              size={24} 
              color={schoolSettingsQuery.data.whatsapp_number ? '#25D366' : theme.textSecondary} 
              style={styles.settingIcon} 
            />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{t('settings.whatsappIntegration')}</Text>
              <Text style={[styles.settingSubtitle, schoolSettingsQuery.data.whatsapp_number && { color: theme.success }]}>
                {schoolSettingsQuery.data.whatsapp_number ? t('settings.whatsappConfigured') : t('settings.whatsappNotConfigured')}
              </Text>
            </View>
          </View>
          {schoolSettingsQuery.data.whatsapp_number && (
            <View style={[styles.settingRight, { backgroundColor: theme.successLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }]}>
              <Text style={{ fontSize: 11, color: theme.success, fontWeight: '600' }}>✓ {t('settings.active')}</Text>
            </View>
          )}
        </View>
        
        {/* Active Features Summary */}
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="checkmark-circle" size={24} color={theme.accent} style={styles.settingIcon} />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{t('settings.activeFeatures')}</Text>
              <Text style={styles.settingSubtitle}>
                {[
                  schoolSettingsQuery.data.features?.activityFeed?.enabled && t('settings.feature.activityFeed'),
                  schoolSettingsQuery.data.features?.financialReports?.enabled && t('settings.feature.financials'),
                  schoolSettingsQuery.data.features?.pettyCash?.enabled && t('settings.feature.pettyCash'),
                ].filter(Boolean).join(' • ') || t('settings.noFeaturesEnabled')}
              </Text>
            </View>
          </View>
        </View>
        
        {/* Edit Full Settings CTA */}
        <TouchableOpacity 
          style={[styles.settingItem, styles.lastSettingItem, { backgroundColor: theme.primaryLight }]}
          onPress={() => router.push('/screens/admin/school-settings')}
        >
          <View style={styles.settingLeft}>
            <Ionicons name="settings" size={24} color={theme.primary} style={styles.settingIcon} />
            <View style={styles.settingContent}>
              <Text style={[styles.settingTitle, { color: theme.primary, fontWeight: '600' }]}>
                {t('settings.editFullSettings')}
              </Text>
              <Text style={[styles.settingSubtitle, { color: theme.primary, opacity: 0.8 }]}>
                {t('settings.configureAllSchoolSettings')}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>
      )}
      
      {/* Error state */}
      {schoolSettingsQuery.isError && (
        <View style={styles.settingsCard}>
          <View style={[styles.settingItem, { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="warning" size={24} color={theme.error} style={styles.settingIcon} />
              <Text style={[styles.settingTitle, { color: theme.error }]}>
                {t('settings.failedToLoadSettings')}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => schoolSettingsQuery.refetch()}
              style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.primary, borderRadius: 8, marginTop: 8 }}
            >
              <Text style={{ color: theme.onPrimary, fontSize: 14, fontWeight: '600' }}>
                {t('common.retry')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
