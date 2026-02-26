/**
 * ReadBySheet Component
 * Bottom sheet showing who read a message, with avatar, name, and timestamp.
 * For group messages: "Read by X of Y" header.
 * Non-readers section with "Send reminder" button for principals.
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  FlatList,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useReadByList, type ReadByEntry } from '@/hooks/messaging/useReadByList';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ReadBySheetProps {
  visible: boolean;
  onClose: () => void;
  messageId: string;
  totalParticipants?: number;
  isPrincipal?: boolean;
  onSendReminder?: () => void;
}

function formatReadAt(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function ReaderRow({ reader, theme }: { reader: ReadByEntry; theme: ReturnType<typeof useTheme>['theme'] }) {
  const initials = reader.userName
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={rowStyles.container}>
      <View style={[rowStyles.avatar, { backgroundColor: theme.primaryLight || theme.primary + '30' }]}>
        {reader.avatarUrl ? (
          <Image source={{ uri: reader.avatarUrl }} style={rowStyles.avatarImage} />
        ) : (
          <Text style={[rowStyles.avatarText, { color: theme.primary }]}>{initials}</Text>
        )}
      </View>
      <View style={rowStyles.textContainer}>
        <Text style={[rowStyles.name, { color: theme.text }]}>{reader.userName}</Text>
        <Text style={[rowStyles.time, { color: theme.textSecondary }]}>{formatReadAt(reader.readAt)}</Text>
      </View>
      <Ionicons name="checkmark-done" size={18} color="#22c55e" />
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  time: {
    fontSize: 12,
    marginTop: 2,
  },
});

export const ReadBySheet: React.FC<ReadBySheetProps> = ({
  visible,
  onClose,
  messageId,
  totalParticipants,
  isPrincipal = false,
  onSendReminder,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const { readers, totalReaders, loading } = useReadByList(messageId);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
    }
  }, [visible, slideAnim]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  const nonReadersCount = totalParticipants != null ? totalParticipants - totalReaders : undefined;
  const headerText =
    totalParticipants != null
      ? `Read by ${totalReaders} of ${totalParticipants}`
      : `Read by ${totalReaders}`;

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: insets.bottom + 16,
      maxHeight: SCREEN_HEIGHT * 0.65,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
        },
        android: { elevation: 8 },
      }),
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: theme.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 8,
    },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    loadingContainer: {
      padding: 32,
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    emptyText: {
      padding: 32,
      textAlign: 'center',
      fontSize: 14,
      color: theme.textSecondary,
    },
    reminderSection: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      padding: 16,
    },
    reminderText: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 10,
    },
    reminderButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 20,
    },
    reminderButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },
  });

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
              <View style={styles.handle} />

              <View style={styles.header}>
                <Text style={styles.headerTitle}>{headerText}</Text>
                {nonReadersCount != null && nonReadersCount > 0 && (
                  <Text style={styles.headerSubtitle}>
                    {nonReadersCount} participant{nonReadersCount !== 1 ? 's' : ''} haven't read yet
                  </Text>
                )}
              </View>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading read receipts...</Text>
                </View>
              ) : readers.length === 0 ? (
                <Text style={styles.emptyText}>No one has read this message yet</Text>
              ) : (
                <FlatList
                  data={readers}
                  keyExtractor={(item) => item.userId}
                  renderItem={({ item }) => <ReaderRow reader={item} theme={theme} />}
                  style={{ maxHeight: SCREEN_HEIGHT * 0.35 }}
                />
              )}

              {isPrincipal && onSendReminder && nonReadersCount != null && nonReadersCount > 0 && (
                <View style={styles.reminderSection}>
                  <Text style={styles.reminderText}>
                    Send a push notification reminder to {nonReadersCount} participant
                    {nonReadersCount !== 1 ? 's' : ''} who haven't read this.
                  </Text>
                  <TouchableOpacity style={styles.reminderButton} onPress={onSendReminder} activeOpacity={0.8}>
                    <Ionicons name="notifications-outline" size={18} color="#ffffff" />
                    <Text style={styles.reminderButtonText}>Send Reminder</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default ReadBySheet;
