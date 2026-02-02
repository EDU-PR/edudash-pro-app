// Principal Meetings Screen - Refactored for WARP.md compliance

import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMeetings } from '@/hooks/principal/useMeetings';
import {
  MeetingCard,
  MeetingFormModal,
  type Meeting,
  type MeetingFormData,
  type MeetingStatus,
} from '@/components/principal/meetings';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
const getDefaultFormData = (): MeetingFormData => {
  const now = new Date();
  const startTime = new Date(now);
  startTime.setHours(9, 0, 0, 0);
  const endTime = new Date(now);
  endTime.setHours(10, 0, 0, 0);

  return {
    title: '',
    description: '',
    meeting_type: 'staff',
    meeting_date: now,
    start_time: startTime,
    end_time: endTime,
    duration_minutes: 60,
    location: '',
    is_virtual: false,
    virtual_link: '',
    agenda_items: [],
    status: 'scheduled',
  };
};

export default function PrincipalMeetingsScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  const {
    meetings,
    loading,
    refreshing,
    activeTab,
    setActiveTab,
    handleRefresh,
    saveMeeting,
    updateStatus,
    deleteMeeting,
  } = useMeetings({
    organizationId: profile?.organization_id,
    userId: profile?.id,
  });

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [formInitialData, setFormInitialData] = useState<MeetingFormData>(getDefaultFormData());

  const handleAddMeeting = useCallback(() => {
    setEditingMeeting(null);
    setFormInitialData(getDefaultFormData());
    setShowFormModal(true);
  }, []);

  const handleEditMeeting = useCallback((meeting: Meeting) => {
    setEditingMeeting(meeting);
    setFormInitialData({
      title: meeting.title,
      description: meeting.description || '',
      meeting_type: meeting.meeting_type,
      meeting_date: new Date(meeting.meeting_date),
      start_time: parseTime(meeting.start_time),
      end_time: meeting.end_time ? parseTime(meeting.end_time) : parseTime(meeting.start_time),
      duration_minutes: meeting.duration_minutes,
      location: meeting.location || '',
      is_virtual: meeting.is_virtual,
      virtual_link: meeting.virtual_link || '',
      agenda_items: meeting.agenda_items || [],
      status: meeting.status,
    });
    setShowFormModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowFormModal(false);
    setEditingMeeting(null);
  }, []);

  const handleMeetingStatusChange = useCallback((meeting: Meeting, newStatus: MeetingStatus) => {
    updateStatus(meeting.id, newStatus);
  }, [updateStatus]);

  const handleViewMeeting = useCallback((meeting: Meeting) => {
    router.push({
      pathname: '/screens/meeting-detail',
      params: { id: meeting.id },
    });
  }, []);

  const renderMeetingCard = useCallback(({ item }: { item: Meeting }) => (
    <MeetingCard
      meeting={item}
      onPress={handleViewMeeting}
      onEdit={handleEditMeeting}
      onStatusChange={handleMeetingStatusChange}
      onDelete={deleteMeeting}
    />
  ), [handleViewMeeting, handleEditMeeting, handleMeetingStatusChange, deleteMeeting]);

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={64} color={theme.textSecondary} />
      <Text style={styles.emptyTitle}>
        {activeTab === 'upcoming' ? 'No Upcoming Meetings' : 'No Past Meetings'}
      </Text>
      <Text style={styles.emptyDescription}>
        {activeTab === 'upcoming'
          ? 'Schedule your first meeting to get started'
          : 'Completed meetings will appear here'}
      </Text>
      {activeTab === 'upcoming' && (
        <TouchableOpacity style={styles.emptyButton} onPress={handleAddMeeting}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.emptyButtonText}>Schedule Meeting</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading meetings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meetings</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddMeeting}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.activeTab]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
            Past
          </Text>
        </TouchableOpacity>
      </View>

      {/* Meeting List */}
      <FlatList
        data={meetings}
        renderItem={renderMeetingCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          meetings.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      />

      {/* Form Modal */}
      <MeetingFormModal
        visible={showFormModal}
        onClose={handleCloseModal}
        onSave={saveMeeting}
        editingMeeting={editingMeeting}
        initialData={formInitialData}
        insetBottom={insets.bottom}
      />
    </SafeAreaView>
  );
}

// Helper to parse time string "HH:MM" to Date
function parseTime(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  addButton: {
    backgroundColor: theme.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: theme.background,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: theme.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  activeTabText: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyListContent: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
