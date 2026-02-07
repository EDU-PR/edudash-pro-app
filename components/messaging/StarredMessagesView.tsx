/**
 * StarredMessagesView — shows all starred messages for a thread.
 *
 * Activated via "Starred Messages" in thread options.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { toast } from '@/components/ui/ToastProvider';

interface StarredMessage {
  id: string;
  content: string;
  content_type: string;
  created_at: string;
  sender?: {
    first_name: string;
    last_name: string;
  };
}

interface StarredMessagesViewProps {
  visible: boolean;
  threadId: string;
  onClose: () => void;
  /** Scroll to message in thread */
  onScrollToMessage?: (messageId: string) => void;
}

export function StarredMessagesView({
  visible,
  threadId,
  onClose,
  onScrollToMessage,
}: StarredMessagesViewProps) {
  const [messages, setMessages] = useState<StarredMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadStarred();
    }
  }, [visible, threadId]);

  const loadStarred = async () => {
    setLoading(true);
    try {
      const supabase = assertSupabase();

      const { data, error } = await supabase
        .from('messages')
        .select(
          `id, content, content_type, created_at,
           sender:users!messages_sender_id_fkey(first_name, last_name)`
        )
        .eq('thread_id', threadId)
        .eq('is_starred', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setMessages((data as any[]) || []);
    } catch (err) {
      logger.error('StarredMessages', 'Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnstar = async (messageId: string) => {
    try {
      const supabase = assertSupabase();
      await supabase
        .from('messages')
        .update({ is_starred: false })
        .eq('id', messageId);

      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast.success('Star removed');
    } catch (err) {
      logger.error('StarredMessages', 'Unstar error:', err);
      toast.error('Failed to remove star');
    }
  };

  const renderItem = ({ item }: { item: StarredMessage }) => {
    const senderName = item.sender
      ? `${item.sender.first_name} ${item.sender.last_name}`
      : 'Unknown';
    const time = new Date(item.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const displayContent =
      item.content_type === 'voice'
        ? '🎤 Voice Message'
        : item.content_type === 'image'
        ? '📷 Photo'
        : item.content_type === 'file'
        ? '📎 File'
        : item.content;

    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => {
          onClose();
          onScrollToMessage?.(item.id);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={styles.senderName}>{senderName}</Text>
            <Text style={styles.time}>{time}</Text>
          </View>
          <Text style={styles.content} numberOfLines={3}>
            {displayContent}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => handleUnstar(item.id)}
          hitSlop={12}
          style={styles.starBtn}
        >
          <Ionicons name="star" size={18} color="#f59e0b" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="star" size={20} color="#f59e0b" />
              <Text style={styles.title}>Starred Messages</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <ActivityIndicator
              size="large"
              color="#6366f1"
              style={{ marginTop: 40 }}
            />
          ) : messages.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="star-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No starred messages</Text>
              <Text style={styles.emptySubtitle}>
                Long-press a message and tap the star to save it here
              </Text>
            </View>
          ) : (
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 30 }}
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
    minHeight: '40%',
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  senderName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  time: {
    fontSize: 11,
    color: '#9ca3af',
  },
  content: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  starBtn: {
    paddingLeft: 12,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default StarredMessagesView;
