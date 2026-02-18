/**
 * ForwardMessagePicker — modal that lets the user pick a thread to forward a message to.
 *
 * Shows the user's existing threads. Tapping one calls `onSelect(threadId)`.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { useBottomInset } from '@/hooks/useBottomInset';

interface ThreadOption {
  id: string;
  displayName: string;
  lastMessageAt: string;
}

interface ForwardMessagePickerProps {
  visible: boolean;
  onSelect: (threadId: string) => void;
  onCancel: () => void;
}

export function ForwardMessagePicker({
  visible,
  onSelect,
  onCancel,
}: ForwardMessagePickerProps) {
  const bottomInset = useBottomInset();
  const { user } = useAuth();
  const [threads, setThreads] = useState<ThreadOption[]>([]);
  const [filtered, setFiltered] = useState<ThreadOption[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && user?.id) {
      loadThreads();
    }
  }, [visible, user?.id]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(threads);
    } else {
      const q = search.toLowerCase();
      setFiltered(threads.filter((t) => t.displayName.toLowerCase().includes(q)));
    }
  }, [search, threads]);

  const loadThreads = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const supabase = assertSupabase();

      // Get all threads where the user is a participant
      const { data: participations, error: pError } = await supabase
        .from('message_participants')
        .select('thread_id')
        .eq('user_id', user.id);

      if (pError) throw pError;

      const threadIds = (participations || []).map((p: any) => p.thread_id);
      if (threadIds.length === 0) {
        setThreads([]);
        setLoading(false);
        return;
      }

      const { data: threadData, error: tError } = await supabase
        .from('message_threads')
        .select(
          `id, subject, last_message_at, is_group, group_name,
           participants:message_participants(
             user_id,
             user_profile:users!message_participants_user_id_fkey(first_name, last_name)
           )`
        )
        .in('id', threadIds)
        .order('last_message_at', { ascending: false })
        .limit(50);

      if (tError) throw tError;

      const options: ThreadOption[] = (threadData || []).map((t: any) => {
        let displayName = t.subject || t.group_name || '';
        if (!displayName && t.participants) {
          // Build name from other participants
          const others = t.participants.filter(
            (p: any) => p.user_id !== user.id
          );
          displayName = others
            .map(
              (p: any) =>
                p.user_profile
                  ? `${p.user_profile.first_name} ${p.user_profile.last_name}`
                  : 'Unknown'
            )
            .join(', ');
        }
        return {
          id: t.id,
          displayName: displayName || 'Untitled Chat',
          lastMessageAt: t.last_message_at,
        };
      });

      setThreads(options);
    } catch (err) {
      logger.error('ForwardPicker', 'Failed to load threads:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: ThreadOption }) => (
    <TouchableOpacity
      style={styles.threadItem}
      onPress={() => onSelect(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        <Ionicons name="chatbubble-ellipses" size={20} color="#6366f1" />
      </View>
      <View style={styles.threadInfo}>
        <Text style={styles.threadName} numberOfLines={1}>
          {item.displayName}
        </Text>
        <Text style={styles.threadDate}>
          {new Date(item.lastMessageAt).toLocaleDateString()}
        </Text>
      </View>
      <Ionicons name="arrow-forward" size={18} color="#9ca3af" />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingBottom: bottomInset + 12 }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Forward to...</Text>
            <TouchableOpacity onPress={onCancel} hitSlop={12}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchBox}>
            <Ionicons
              name="search"
              size={18}
              color="#9ca3af"
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search chats..."
              placeholderTextColor="#9ca3af"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>

          {/* List */}
          {loading ? (
            <ActivityIndicator
              size="large"
              color="#6366f1"
              style={{ marginTop: 32 }}
            />
          ) : filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No chats found</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  threadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  threadInfo: {
    flex: 1,
  },
  threadName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  threadDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 15,
  },
});

export default ForwardMessagePicker;
