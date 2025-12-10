/**
 * Calls History Screen
 * 
 * Shows call history including missed, received, and made calls.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { useCallSafe } from '@/components/calls/CallProvider';
import { useMarkCallsSeen } from '@/hooks/useMissedCalls';
import { useCallHistory, filterCalls, getCallCounts, CallFilter } from '@/hooks/useCallHistory';
import { CallItem } from '@/components/calls/CallItem';
import { CallFilterChip } from '@/components/calls/CallFilterChip';

// Custom Header Component
interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  };
}

const ScreenHeader = ({ title, subtitle, onBack, rightAction }: ScreenHeaderProps) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: theme.surface }]}>
      <TouchableOpacity 
        style={styles.headerBackButton} 
        onPress={onBack || (() => router.back())}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="arrow-back" size={24} color={theme.text} />
      </TouchableOpacity>
      
      <View style={styles.headerTitleContainer}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
        )}
      </View>
      
      {rightAction ? (
        <TouchableOpacity 
          style={styles.headerRightButton} 
          onPress={rightAction.onPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={rightAction.icon} size={24} color={theme.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerRightButton} />
      )}
    </View>
  );
};

export default function CallsScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<CallFilter>('all');
  
  const { data: calls = [], isLoading, refetch } = useCallHistory();
  const [refreshing, setRefreshing] = useState(false);
  
  // Mark calls as seen when screen mounts
  const { mutate: markCallsSeen } = useMarkCallsSeen();
  
  // Mark as seen on mount
  React.useEffect(() => {
    markCallsSeen();
  }, [markCallsSeen]);
  
  // Get call context for making calls (safe even if CallProvider isn't mounted)
  const callContext = useCallSafe();

  // Filter calls using extracted function
  const filteredCalls = useMemo(() => {
    if (!user?.id) return [];
    return filterCalls(calls, filterType, user.id);
  }, [calls, filterType, user?.id]);
  
  // Counts using extracted function
  const counts = useMemo(() => {
    if (!user?.id) return { all: 0, missed: 0, incoming: 0, outgoing: 0 };
    return getCallCounts(calls, user.id);
  }, [calls, user?.id]);
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };
  
  const handleClearCallHistory = useCallback(() => {
    if (calls.length === 0) {
      Alert.alert(
        t('calls.no_history', { defaultValue: 'No History' }),
        t('calls.history_empty', { defaultValue: 'Your call history is already empty.' })
      );
      return;
    }
    
    Alert.alert(
      t('calls.clear_history', { defaultValue: 'Clear Call History' }),
      t('calls.clear_history_confirm', { defaultValue: 'Are you sure you want to clear all call history? This action cannot be undone.' }),
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: t('common.clear', { defaultValue: 'Clear' }),
          style: 'destructive',
          onPress: async () => {
            try {
              const client = assertSupabase();
              
              // Delete calls where user is caller or callee
              const { error } = await client
                .from('active_calls')
                .delete()
                .or(`caller_id.eq.${user?.id},callee_id.eq.${user?.id}`);
              
              if (error) {
                console.error('[ClearCallHistory] Error:', error);
                Alert.alert(
                  t('common.error', { defaultValue: 'Error' }),
                  t('calls.clear_error', { defaultValue: 'Failed to clear call history. Please try again.' })
                );
                return;
              }
              
              // Refresh the list
              await refetch();
              
              Alert.alert(
                t('common.success', { defaultValue: 'Success' }),
                t('calls.history_cleared', { defaultValue: 'Call history has been cleared.' })
              );
            } catch (error) {
              console.error('[ClearCallHistory] Exception:', error);
              Alert.alert(
                t('common.error', { defaultValue: 'Error' }),
                t('calls.clear_error', { defaultValue: 'Failed to clear call history. Please try again.' })
              );
            }
          },
        },
      ]
    );
  }, [calls.length, user?.id, refetch, t]);
  
  const handleCall = useCallback((userId: string, userName: string, callType: 'voice' | 'video') => {
    if (!callContext) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('calls.not_available', { defaultValue: 'Calling is not available right now.' })
      );
      return;
    }
    
    if (callType === 'voice') {
      callContext.startVoiceCall(userId, userName);
    } else {
      callContext.startVideoCall(userId, userName);
    }
  }, [callContext, t]);
  
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader 
        title={t('calls.title', { defaultValue: 'Calls' })}
        subtitle={t('calls.history', { defaultValue: 'Call History' })}
        rightAction={{
          icon: 'trash-outline',
          onPress: handleClearCallHistory,
        }}
      />
      
      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <CallFilterChip 
            label={t('calls.all', { defaultValue: 'All' })} 
            active={filterType === 'all'} 
            onPress={() => setFilterType('all')}
            count={counts.all}
          />
          <CallFilterChip 
            label={t('calls.missed', { defaultValue: 'Missed' })} 
            active={filterType === 'missed'} 
            onPress={() => setFilterType('missed')}
            count={counts.missed}
          />
          <CallFilterChip 
            label={t('calls.incoming', { defaultValue: 'Incoming' })} 
            active={filterType === 'incoming'} 
            onPress={() => setFilterType('incoming')}
            count={counts.incoming}
          />
          <CallFilterChip 
            label={t('calls.outgoing', { defaultValue: 'Outgoing' })} 
            active={filterType === 'outgoing'} 
            onPress={() => setFilterType('outgoing')}
            count={counts.outgoing}
          />
        </ScrollView>
      </View>
      
      <ScrollView 
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
      >
        {isLoading ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonLoader key={i} width="100%" height={72} borderRadius={12} style={{ marginBottom: 8 }} />
            ))}
          </>
        ) : filteredCalls.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="call-outline" size={48} color={theme.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {t('calls.no_calls', { defaultValue: 'No Calls Yet' })}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {t('calls.no_calls_desc', { defaultValue: 'Your call history will appear here. Start a conversation and make a call!' })}
            </Text>
          </View>
        ) : (
          filteredCalls.map((call: any) => (
            <CallItem 
              key={call.id} 
              call={call} 
              currentUserId={user?.id || ''} 
              onCall={handleCall}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRightButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    paddingVertical: 12,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

const callStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  status: {
    fontSize: 12,
    fontWeight: '500',
  },
  separator: {
    fontSize: 12,
    marginHorizontal: 6,
  },
  time: {
    fontSize: 12,
  },
  duration: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const filterStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chipBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  chipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
