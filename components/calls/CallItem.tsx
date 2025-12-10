/**
 * CallItem Component
 * Displays individual call history item with status, time, and action buttons
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { EnrichedCallRecord } from '@/hooks/useCallHistory';

interface CallItemProps {
  call: EnrichedCallRecord;
  currentUserId: string;
  onCall: (userId: string, userName: string, callType: 'voice' | 'video') => void;
}

export const CallItem: React.FC<CallItemProps> = ({ call, currentUserId, onCall }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  
  const isIncoming = call.callee_id === currentUserId;
  const otherUserId = isIncoming ? call.caller_id : call.callee_id;
  const otherUserName = isIncoming ? call.caller_name : call.callee_name;
  
  // Helper to determine if call was actually answered
  const wasCallAnswered = (call.duration_seconds ?? 0) > 0;
  
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
        // If incoming call ended but was never answered (no duration), it's a missed call
        if (isIncoming && !wasCallAnswered) {
          return { 
            icon: 'call-outline' as const, 
            color: theme.error, 
            label: t('calls.missed', { defaultValue: 'Missed' }),
            iconRotation: 135,
          };
        }
        // If outgoing call ended but was never answered, show as "No Answer"
        if (!isIncoming && !wasCallAnswered) {
          return { 
            icon: 'call-outline' as const, 
            color: theme.warning, 
            label: t('calls.no_answer', { defaultValue: 'No Answer' }),
            iconRotation: -45,
          };
        }
        // Call was connected and ended normally
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
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={styles.left}>
        <View style={[styles.avatar, { backgroundColor: statusConfig.color + '20' }]}>
          <Ionicons 
            name={call.call_type === 'video' ? 'videocam' : 'call'} 
            size={20} 
            color={statusConfig.color}
            style={{ transform: [{ rotate: `${statusConfig.iconRotation}deg` }] }}
          />
        </View>
        
        <View style={styles.info}>
          <Text style={[styles.name, { color: theme.text }]}>{otherUserName}</Text>
          <View style={styles.detailRow}>
            <Text style={[styles.status, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
            <Text style={[styles.separator, { color: theme.textSecondary }]}>•</Text>
            <Text style={[styles.time, { color: theme.textSecondary }]}>
              {formatTime(call.started_at)}
            </Text>
            {call.duration_seconds ? (
              <>
                <Text style={[styles.separator, { color: theme.textSecondary }]}>•</Text>
                <Text style={[styles.duration, { color: theme.textSecondary }]}>
                  {formatDuration(call.duration_seconds)}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </View>
      
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.success + '20' }]}
          onPress={() => onCall(otherUserId, otherUserName, 'voice')}
        >
          <Ionicons name="call" size={18} color={theme.success} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.info + '20' }]}
          onPress={() => onCall(otherUserId, otherUserName, 'video')}
        >
          <Ionicons name="videocam" size={18} color={theme.info} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  status: {
    fontSize: 13,
    fontWeight: '500',
  },
  separator: {
    fontSize: 12,
    marginHorizontal: 6,
  },
  time: {
    fontSize: 13,
  },
  duration: {
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
