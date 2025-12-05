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
import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { useCall } from '@/components/calls/CallProvider';

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

const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, subtitle, onBack, rightAction }) => {
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

// Call Item Component
interface CallItemProps {
  call: {
    id: string;
    call_type: 'voice' | 'video';
    status: 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed' | 'busy';
    caller_id: string;
    callee_id: string;
    caller_name?: string;
    callee_name?: string;
    started_at: string;
    ended_at?: string;
    duration_seconds?: number;
  };
  currentUserId: string;
  onCall: (userId: string, userName: string, callType: 'voice' | 'video') => void;
}

const CallItem: React.FC<CallItemProps> = ({ call, currentUserId, onCall }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  
  const isIncoming = call.callee_id === currentUserId;
  const otherUserId = isIncoming ? call.caller_id : call.callee_id;
  const otherUserName = isIncoming ? (call.caller_name || 'Unknown') : (call.callee_name || 'Unknown');
  
  const getStatusConfig = () => {
    switch (call.status) {
      case 'missed':
        return { 
          icon: 'call-outline' as const, 
          color: theme.error, 
          label: t('calls.missed', { defaultValue: 'Missed' }),
          iconRotation: isIncoming ? 135 : -45,
        };
      case 'rejected':
        return { 
          icon: 'close-circle-outline' as const, 
          color: theme.error, 
          label: t('calls.declined', { defaultValue: 'Declined' }),
          iconRotation: 0,
        };
      case 'ended':
        return { 
          icon: isIncoming ? 'call-outline' : 'call-outline', 
          color: isIncoming ? theme.success : theme.info, 
          label: isIncoming ? t('calls.received', { defaultValue: 'Received' }) : t('calls.outgoing', { defaultValue: 'Outgoing' }),
          iconRotation: isIncoming ? 135 : -45,
        };
      case 'busy':
        return { 
          icon: 'close-outline' as const, 
          color: theme.warning, 
          label: t('calls.busy', { defaultValue: 'Busy' }),
          iconRotation: 0,
        };
      default:
        return { 
          icon: 'call-outline' as const, 
          color: theme.textSecondary, 
          label: call.status,
          iconRotation: 0,
        };
    }
  };
  
  const statusConfig = getStatusConfig();
  
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffHours < 168) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };
  
  return (
    <View style={[callStyles.container, { backgroundColor: theme.surface }]}>
      <View style={callStyles.left}>
        <View style={[callStyles.avatar, { backgroundColor: statusConfig.color + '20' }]}>
          <Ionicons 
            name={call.call_type === 'video' ? 'videocam' : 'call'} 
            size={20} 
            color={statusConfig.color}
            style={{ transform: [{ rotate: `${statusConfig.iconRotation}deg` }] }}
          />
        </View>
        
        <View style={callStyles.info}>
          <Text style={[callStyles.name, { color: theme.text }]}>{otherUserName}</Text>
          <View style={callStyles.detailRow}>
            <Text style={[callStyles.status, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
            <Text style={[callStyles.separator, { color: theme.textSecondary }]}>•</Text>
            <Text style={[callStyles.time, { color: theme.textSecondary }]}>
              {formatTime(call.started_at)}
            </Text>
            {call.duration_seconds ? (
              <>
                <Text style={[callStyles.separator, { color: theme.textSecondary }]}>•</Text>
                <Text style={[callStyles.duration, { color: theme.textSecondary }]}>
                  {formatDuration(call.duration_seconds)}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </View>
      
      <View style={callStyles.actions}>
        <TouchableOpacity 
          style={[callStyles.actionButton, { backgroundColor: theme.success + '20' }]}
          onPress={() => onCall(otherUserId, otherUserName, 'voice')}
        >
          <Ionicons name="call" size={18} color={theme.success} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[callStyles.actionButton, { backgroundColor: theme.info + '20' }]}
          onPress={() => onCall(otherUserId, otherUserName, 'video')}
        >
          <Ionicons name="videocam" size={18} color={theme.info} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Filter Chip Component
interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  count?: number;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, active, onPress, count }) => {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity 
      style={[
        filterStyles.chip,
        { backgroundColor: active ? theme.primary : theme.surface },
        { borderColor: active ? theme.primary : theme.border }
      ]}
      onPress={onPress}
    >
      <Text style={[filterStyles.chipText, { color: active ? theme.onPrimary : theme.text }]}>
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View style={[filterStyles.chipBadge, { backgroundColor: active ? theme.onPrimary : theme.primary }]}>
          <Text style={[filterStyles.chipBadgeText, { color: active ? theme.primary : theme.onPrimary }]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Hook to fetch call history
const useCallHistory = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['call-history', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const client = assertSupabase();
      
      // Fetch calls where user is caller or callee
      const { data, error } = await client
        .from('active_calls')
        .select('*')
        .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
        .order('started_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('[useCallHistory] Error:', error);
        return [];
      }
      
      // Fetch user names for the calls
      const userIds = new Set<string>();
      data?.forEach(call => {
        userIds.add(call.caller_id);
        userIds.add(call.callee_id);
      });
      
      const { data: profiles } = await client
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', Array.from(userIds));
      
      const profileMap = new Map(profiles?.map(p => [p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim()]) || []);
      
      return data?.map(call => ({
        ...call,
        caller_name: profileMap.get(call.caller_id) || 'Unknown',
        callee_name: profileMap.get(call.callee_id) || 'Unknown',
      })) || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60, // 1 minute
  });
};

export default function CallsScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<'all' | 'missed' | 'incoming' | 'outgoing'>('all');
  
  const { data: calls = [], isLoading, refetch } = useCallHistory();
  const [refreshing, setRefreshing] = useState(false);
  
  // Get call context for making calls
  let callContext: ReturnType<typeof useCall> | null = null;
  try {
    callContext = useCall();
  } catch {
    // Call provider not available
  }
  
  // Filter calls
  const filteredCalls = useMemo(() => {
    if (!user?.id) return [];
    
    return calls.filter((call: any) => {
      if (filter === 'all') return true;
      if (filter === 'missed') return call.status === 'missed' && call.callee_id === user.id;
      if (filter === 'incoming') return call.callee_id === user.id;
      if (filter === 'outgoing') return call.caller_id === user.id;
      return true;
    });
  }, [calls, filter, user?.id]);
  
  // Counts
  const counts = useMemo(() => {
    if (!user?.id) return { all: 0, missed: 0, incoming: 0, outgoing: 0 };
    
    return {
      all: calls.length,
      missed: calls.filter((c: any) => c.status === 'missed' && c.callee_id === user.id).length,
      incoming: calls.filter((c: any) => c.callee_id === user.id).length,
      outgoing: calls.filter((c: any) => c.caller_id === user.id).length,
    };
  }, [calls, user?.id]);
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };
  
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
      />
      
      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <FilterChip 
            label={t('calls.all', { defaultValue: 'All' })} 
            active={filter === 'all'} 
            onPress={() => setFilter('all')}
            count={counts.all}
          />
          <FilterChip 
            label={t('calls.missed', { defaultValue: 'Missed' })} 
            active={filter === 'missed'} 
            onPress={() => setFilter('missed')}
            count={counts.missed}
          />
          <FilterChip 
            label={t('calls.incoming', { defaultValue: 'Incoming' })} 
            active={filter === 'incoming'} 
            onPress={() => setFilter('incoming')}
            count={counts.incoming}
          />
          <FilterChip 
            label={t('calls.outgoing', { defaultValue: 'Outgoing' })} 
            active={filter === 'outgoing'} 
            onPress={() => setFilter('outgoing')}
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
