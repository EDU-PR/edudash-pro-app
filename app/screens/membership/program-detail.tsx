/**
 * Youth Program Detail Screen
 * Shows detailed view of a youth program for the Youth President dashboard
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { STATUS_CONFIG, CATEGORY_ICONS } from '@/hooks/membership/useYouthPrograms';
import { styles } from '@/components/membership/styles/program-detail.styles';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
interface YouthProgramDetail {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  start_date: string;
  end_date: string | null;
  budget: number | null;
  max_participants: number | null;
  organization_id: string;
  created_by: string;
  created_at: string;
}

interface Participant {
  id: string;
  user_id: string;
  joined_at: string;
  user: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
  }).format(amount);

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export default function YouthProgramDetailScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { showAlert, alertProps } = useAlertModal();

  // Fetch program details
  const {
    data: program,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['youth-program-detail', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await assertSupabase()
        .from('youth_programs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as YouthProgramDetail;
    },
    enabled: !!id,
  });

  // Fetch participants
  const { data: participants, isLoading: loadingParticipants } = useQuery({
    queryKey: ['youth-program-participants', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await assertSupabase()
        .from('youth_program_participants')
        .select(`
          id,
          user_id,
          joined_at,
          user:profiles!youth_program_participants_user_id_fkey(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('program_id', id)
        .order('joined_at', { ascending: false });

      if (error) throw error;
      
      // Transform to flatten the user array from Supabase join
      const transformed = (data || []).map((item: any) => ({
        ...item,
        user: Array.isArray(item.user) ? item.user[0] : item.user,
      }));
      
      return transformed as Participant[];
    },
    enabled: !!id,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await assertSupabase()
        .from('youth_programs')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youth-program-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['youth-programs'] });
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleStatusChange = (newStatus: string) => {
    showAlert({
      title: 'Change Status',
      message: `Are you sure you want to change the program status to ${newStatus}?`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => updateStatusMutation.mutate(newStatus),
        },
      ],
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <EduDashSpinner size="large" color="#10B981" />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading program...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !program) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.error} />
          <Text style={[styles.errorTitle, { color: theme.text }]}>Program Not Found</Text>
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>
            This program may have been deleted or you don't have access.
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: '#10B981' }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[program.status];
  const categoryIcon = CATEGORY_ICONS[program.category] || 'folder';

  return (
    <DashboardWallpaperBackground>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />

        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.card }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
              {program.name}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() =>
              router.push({
                pathname: '/screens/membership/edit-youth-program',
                params: { id: program.id },
              })
            }
          >
            <Ionicons name="create-outline" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#10B981']}
              tintColor="#10B981"
            />
          }
        >
          {/* Status & Category */}
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.statusRow}>
              <View style={[styles.categoryIcon, { backgroundColor: '#10B981' + '20' }]}>
                <Ionicons name={categoryIcon as any} size={32} color="#10B981" />
              </View>
              <View style={styles.statusInfo}>
                <Text style={[styles.categoryLabel, { color: theme.textSecondary }]}>
                  {program.category}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
                  <Ionicons name={statusConfig.icon as any} size={16} color={statusConfig.color} />
                  <Text style={[styles.statusText, { color: statusConfig.color }]}>
                    {statusConfig.label}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Description */}
          {program.description && (
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Description</Text>
              <Text style={[styles.description, { color: theme.textSecondary }]}>
                {program.description}
              </Text>
            </View>
          )}

          {/* Details */}
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Details</Text>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Ionicons name="calendar-outline" size={20} color={theme.textSecondary} />
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
                    Start Date
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {formatDate(program.start_date)}
                  </Text>
                </View>
              </View>
              {program.end_date && (
                <View style={styles.detailItem}>
                  <Ionicons name="calendar" size={20} color={theme.textSecondary} />
                  <View style={styles.detailContent}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
                      End Date
                    </Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>
                      {formatDate(program.end_date)}
                    </Text>
                  </View>
                </View>
              )}
              {program.budget !== null && (
                <View style={styles.detailItem}>
                  <Ionicons name="cash-outline" size={20} color={theme.textSecondary} />
                  <View style={styles.detailContent}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Budget</Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>
                      {formatCurrency(program.budget)}
                    </Text>
                  </View>
                </View>
              )}
              <View style={styles.detailItem}>
                <Ionicons name="people-outline" size={20} color={theme.textSecondary} />
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
                    Participants
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {participants?.length || 0}
                    {program.max_participants && ` / ${program.max_participants}`}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Participants */}
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Participants</Text>
              <TouchableOpacity
                style={[styles.addParticipantButton, { backgroundColor: '#10B981' }]}
                onPress={() =>
                  router.push({
                    pathname: '/screens/membership/add-participant',
                    params: { programId: program.id },
                  })
                }
              >
                <Ionicons name="person-add" size={16} color="#fff" />
                <Text style={styles.addParticipantText}>Add</Text>
              </TouchableOpacity>
            </View>

            {loadingParticipants ? (
              <EduDashSpinner size="small" color="#10B981" style={styles.participantsLoader} />
            ) : participants && participants.length > 0 ? (
              <View style={styles.participantsList}>
                {participants.slice(0, 5).map((participant) => (
                  <View key={participant.id} style={styles.participantItem}>
                    <View style={[styles.participantAvatar, { backgroundColor: '#10B981' + '20' }]}>
                      <Text style={[styles.participantInitials, { color: '#10B981' }]}>
                        {(participant.user?.first_name?.[0] || '?').toUpperCase()}
                        {(participant.user?.last_name?.[0] || '').toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.participantInfo}>
                      <Text style={[styles.participantName, { color: theme.text }]}>
                        {participant.user?.first_name} {participant.user?.last_name}
                      </Text>
                      <Text style={[styles.participantEmail, { color: theme.textSecondary }]}>
                        Joined {formatDate(participant.joined_at)}
                      </Text>
                    </View>
                  </View>
                ))}
                {participants.length > 5 && (
                  <TouchableOpacity style={styles.viewAllButton}>
                    <Text style={[styles.viewAllText, { color: '#10B981' }]}>
                      View all {participants.length} participants
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.emptyParticipants}>
                <Ionicons name="people-outline" size={40} color={theme.textSecondary} />
                <Text style={[styles.emptyParticipantsText, { color: theme.textSecondary }]}>
                  No participants yet
                </Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Actions</Text>
            <View style={styles.actionsGrid}>
              {program.status === 'draft' && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#10B981' }]}
                  onPress={() => handleStatusChange('active')}
                >
                  <Ionicons name="play" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Activate</Text>
                </TouchableOpacity>
              )}
              {program.status === 'active' && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#3B82F6' }]}
                  onPress={() => handleStatusChange('completed')}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Complete</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }]}
                onPress={() =>
                  router.push({
                    pathname: '/screens/membership/edit-youth-program',
                    params: { id: program.id },
                  })
                }
              >
                <Ionicons name="create-outline" size={20} color={theme.text} />
                <Text style={[styles.actionButtonText, { color: theme.text }]}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
      <AlertModal {...alertProps} />
    </DashboardWallpaperBackground>
  );
}
