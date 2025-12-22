/**
 * Super Admin Announcements Screen
 * 
 * Platform-wide announcements management for super admins.
 * 
 * Refactored to use extracted components from components/super-admin/announcements/
 */

import React from 'react';
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
import {
  useAnnouncements,
  AnnouncementCard,
  AnnouncementModal,
} from '@/components/super-admin/announcements';

export default function SuperAdminAnnouncementsScreen() {
  const { theme } = useTheme();

  const {
    announcements,
    loading,
    refreshing,
    saving,
    showCreateModal,
    showEditModal,
    formData,
    isAuthorized,
    activeCount,
    onRefresh,
    openCreateModal,
    closeModal,
    openEditModal,
    updateFormField,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    toggleAnnouncementStatus,
  } = useAnnouncements();

  // Access denied screen
  if (!isAuthorized) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Platform Announcements', headerShown: false }} />
        <StatusBar style="light" />
        <SafeAreaView style={styles.deniedContainer}>
          <Text style={styles.deniedText}>Access Denied - Super Admin Only</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Platform Announcements', headerShown: false }} />
      <StatusBar style="light" />
      
      {/* Header */}
      <SafeAreaView style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Platform Announcements</Text>
          <TouchableOpacity onPress={openCreateModal} style={styles.addButton}>
            <Ionicons name="add" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
        
        {/* Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>
            {announcements.length} announcements • {activeCount} active
          </Text>
        </View>
      </SafeAreaView>

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
            <Text style={styles.loadingText}>Loading announcements...</Text>
          </View>
        ) : (
          <>
            {announcements.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                theme={theme}
                onEdit={() => openEditModal(announcement)}
                onDelete={() => deleteAnnouncement(announcement)}
                onToggleStatus={() => toggleAnnouncementStatus(announcement)}
              />
            ))}

            {announcements.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="megaphone-outline" size={48} color="#9ca3af" />
                <Text style={styles.emptyText}>No announcements</Text>
                <Text style={styles.emptySubText}>Create your first platform announcement</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <AnnouncementModal
        visible={showCreateModal || showEditModal}
        isEditing={showEditModal}
        formData={formData}
        saving={saving}
        theme={theme}
        onClose={closeModal}
        onSave={showCreateModal ? createAnnouncement : updateAnnouncement}
        onUpdateField={updateFormField}
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
  addButton: {
    padding: 8,
  },
  statsContainer: {
    paddingBottom: 16,
  },
  statsText: {
    color: '#9ca3af',
    fontSize: 12,
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
