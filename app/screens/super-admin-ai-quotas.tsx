/**
 * Super Admin AI Quotas Screen
 * Manages AI usage quotas across all schools
 * 
 * Refactored per WARP.md standards - extracted components to:
 * @see components/super-admin/ai-quotas/
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

// Extracted components
import {
  useAIQuotaManagement,
  QuotaStatsGrid,
  QuotaFiltersBar,
  SchoolQuotaCard,
  TopConsumingSchools,
  GlobalConfigModal,
  SchoolDetailModal,
  AIQuotaSettings,
} from '@/components/super-admin/ai-quotas';

export default function SuperAdminAIQuotasScreen() {
  const { theme } = useTheme();
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<AIQuotaSettings | null>(null);

  const {
    loading,
    refreshing,
    saving,
    isAuthorized,
    filteredSchools,
    globalConfig,
    usageStats,
    filters,
    setGlobalConfig,
    setFilters,
    onRefresh,
    suspendSchool,
    resetSchoolUsage,
    updateGlobalConfig,
  } = useAIQuotaManagement();

  // Handle school card press
  const handleSchoolPress = (school: AIQuotaSettings) => {
    setSelectedSchool(school);
    setShowSchoolModal(true);
  };

  // Handle school modal close
  const handleSchoolModalClose = () => {
    setShowSchoolModal(false);
    setSelectedSchool(null);
  };

  // Handle global config save
  const handleConfigSave = () => {
    updateGlobalConfig(() => setShowConfigModal(false));
  };

  // Access denied state
  if (!isAuthorized) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'AI Quota Management', headerShown: false }} />
        <StatusBar style="light" />
        <SafeAreaView style={styles.deniedContainer}>
          <Text style={styles.deniedText}>Access Denied - Super Admin Only</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'AI Quota Management', headerShown: false }} />
      <StatusBar style="light" />
      
      {/* Header */}
      <SafeAreaView style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/screens/super-admin-dashboard');
              }
            }} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>AI Quota Management</Text>
          <TouchableOpacity 
            onPress={() => setShowConfigModal(true)} 
            style={styles.configButton}
          >
            <Ionicons name="settings" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
        
        {/* Stats Grid */}
        <QuotaStatsGrid stats={usageStats} />
      </SafeAreaView>

      {/* Filters */}
      <QuotaFiltersBar 
        filters={filters} 
        onFiltersChange={setFilters} 
      />

      {/* Main Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={theme.primary} 
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Loading AI quotas...</Text>
          </View>
        ) : (
          <>
            {/* School List */}
            {filteredSchools.map((school) => (
              <SchoolQuotaCard
                key={school.id}
                school={school}
                onPress={handleSchoolPress}
              />
            ))}

            {/* Empty State */}
            {filteredSchools.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="bar-chart-outline" size={48} color={theme.textTertiary} />
                <Text style={styles.emptyText}>No schools found</Text>
                <Text style={styles.emptySubText}>Try adjusting your search or filters</Text>
              </View>
            )}

            {/* Top Consuming Schools */}
            <TopConsumingSchools schools={usageStats.top_consuming_schools} />
          </>
        )}
      </ScrollView>

      {/* Global Config Modal */}
      <GlobalConfigModal
        visible={showConfigModal}
        config={globalConfig}
        saving={saving}
        onConfigChange={setGlobalConfig}
        onSave={handleConfigSave}
        onClose={() => setShowConfigModal(false)}
      />

      {/* School Detail Modal */}
      <SchoolDetailModal
        visible={showSchoolModal}
        school={selectedSchool}
        onClose={handleSchoolModalClose}
        onResetUsage={resetSchoolUsage}
        onSuspend={suspendSchool}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  deniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0b1220',
  },
  deniedText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#0b1220',
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  configButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    backgroundColor: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 4,
  },
});
