/**
 * Cache Management Component
 * 
 * Provides administrators (especially Principals) with tools to monitor
 * and manage offline cache across their school's data.
 * 
 * Features:
 * - Cache statistics and health monitoring
 * - Selective cache clearing for school data
 * - Cache size optimization tools
 * - Debug information for troubleshooting
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { offlineCacheService } from '@/lib/services/offlineCacheService';
import { logger } from '@/lib/logger';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { styles } from './CacheManagement.styles';

interface CacheStats {
  totalSize: number;
  entryCount: number;
  oldestEntry: number;
  newestEntry: number;
  hitRate: number;
}

interface CacheManagementProps {
  onClose: () => void;
  schoolId?: string;
}

export const CacheManagement: React.FC<CacheManagementProps> = ({
  onClose,
  schoolId
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert, alertProps } = useAlertModal();
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const loadStats = async () => {
    try {
      setLoading(true);
      const cacheStats = await offlineCacheService.getCacheStats();
      setStats(cacheStats);
    } catch (error) {
      logger.error('Failed to load cache stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDate = (timestamp: number): string => {
    if (timestamp === 0) return 'Never';
    return new Date(timestamp).toLocaleString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleClearUserCache = () => {
    showAlert({
      title: t('cache.clear_personal_title'),
      message: t('cache.clear_personal_message'),
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('cache.clear'),
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            setClearing(true);
            try {
              await offlineCacheService.clearUserCache(user.id);
              showAlert({ title: t('common.success'), message: t('cache.personal_cleared') });
              await loadStats();
            } catch (error) {
              showAlert({ title: t('common.error'), message: t('cache.clear_failed') });
              logger.error('Failed to clear user cache:', error);
            } finally {
              setClearing(false);
            }
          }
        }
      ],
    });
  };

  const handleClearSchoolCache = () => {
    if (!schoolId || !user?.id) {
      showAlert({ title: t('common.error'), message: t('cache.school_info_unavailable') });
      return;
    }

    showAlert({
      title: t('cache.clear_school_title'),
      message: t('cache.clear_school_message'),
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('cache.clear_school_button'),
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              await offlineCacheService.clearSchoolCache(schoolId, user.id);
              showAlert({ title: t('common.success'), message: t('cache.school_cleared') });
              await loadStats();
            } catch (error) {
              showAlert({ title: t('common.error'), message: t('cache.clear_school_failed') });
              logger.error('Failed to clear school cache:', error);
            } finally {
              setClearing(false);
            }
          }
        }
      ],
    });
  };

  const getHealthStatus = (): { status: 'good' | 'warning' | 'critical', message: string } => {
    if (!stats) return { status: 'warning', message: t('cache.status_unknown') };
    if (stats.totalSize > 8 * 1024 * 1024) {
      return { status: 'critical', message: t('cache.size_very_large') };
    } else if (stats.totalSize > 5 * 1024 * 1024) {
      return { status: 'warning', message: t('cache.size_moderate') };
    } else if (stats.hitRate < 0.3) {
      return { status: 'warning', message: t('cache.efficiency_low') };
    }
    return { status: 'good', message: t('cache.operating_efficiently') };
  };

  const health = getHealthStatus();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('cache.management')}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={Colors.light.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <EduDashSpinner size="large" color={Colors.light.tint} />
            <Text style={styles.loadingText}>{t('cache.loading_stats')}</Text>
          </View>
        ) : (
          <>
            {/* Health Status */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons 
                  name={health.status === 'good' ? 'checkmark-circle' : health.status === 'warning' ? 'warning' : 'alert-circle'} 
                  size={20} 
                  color={health.status === 'good' ? '#059669' : health.status === 'warning' ? '#EA580C' : '#DC2626'} 
                />
                <Text style={styles.sectionTitle}>{t('cache.health')}</Text>
              </View>
              <View style={[styles.healthBadge, { 
                backgroundColor: health.status === 'good' ? '#059669' : health.status === 'warning' ? '#EA580C' : '#DC2626' 
              }]}>
                <Text style={styles.healthText}>{health.message}</Text>
              </View>
            </View>

            {/* Statistics */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="bar-chart" size={20} color={Colors.light.tint} />
                <Text style={styles.sectionTitle}>{t('cache.statistics')}</Text>
              </View>
              
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{formatBytes(stats?.totalSize || 0)}</Text>
                  <Text style={styles.statLabel}>{t('cache.total_size')}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats?.entryCount || 0}</Text>
                  <Text style={styles.statLabel}>{t('cache.entries')}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{Math.round((stats?.hitRate || 0) * 100)}%</Text>
                  <Text style={styles.statLabel}>{t('cache.hit_rate')}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{formatDate(stats?.newestEntry || 0)}</Text>
                  <Text style={styles.statLabel}>{t('cache.last_updated')}</Text>
                </View>
              </View>
            </View>

            {/* Cache Actions */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="build" size={20} color={Colors.light.tint} />
                <Text style={styles.sectionTitle}>{t('cache.management')}</Text>
              </View>
              
              <TouchableOpacity style={styles.actionButton} onPress={handleClearUserCache} disabled={clearing}>
                <Ionicons name="person" size={20} color={Colors.light.tint} />
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>{t('cache.clear_personal')}</Text>
                  <Text style={styles.actionDescription}>{t('cache.clear_personal_desc')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.light.tabIconDefault} />
              </TouchableOpacity>

              {schoolId && (
                <TouchableOpacity style={styles.actionButton} onPress={handleClearSchoolCache} disabled={clearing}>
                  <Ionicons name="school" size={20} color="#DC2626" />
                  <View style={styles.actionContent}>
                    <Text style={[styles.actionTitle, { color: '#DC2626' }]}>{t('cache.clear_school')}</Text>
                    <Text style={styles.actionDescription}>{t('cache.clear_school_desc')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.light.tabIconDefault} />
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.actionButton} onPress={loadStats} disabled={clearing}>
                <Ionicons name="refresh" size={20} color={Colors.light.tabIconDefault} />
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>{t('cache.refresh_stats')}</Text>
                  <Text style={styles.actionDescription}>{t('cache.refresh_stats_desc')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.light.tabIconDefault} />
              </TouchableOpacity>
            </View>

            {/* Information */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="information-circle" size={20} color={Colors.light.tabIconDefault} />
                <Text style={styles.sectionTitle}>{t('cache.about')}</Text>
              </View>
              <Text style={styles.infoText}>{t('cache.about_description')}</Text>
              <Text style={styles.infoText}>{t('cache.about_details')}</Text>
            </View>

            {clearing && (
              <View style={styles.clearingOverlay}>
                <EduDashSpinner size="large" color={Colors.light.tint} />
                <Text style={styles.clearingText}>{t('cache.clearing')}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
      <AlertModal {...alertProps} />
    </View>
  );
};
