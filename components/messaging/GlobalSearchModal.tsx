/**
 * GlobalSearchModal — Full-screen modal for searching messages across all threads.
 *
 * Features:
 * - Debounced search input at top
 * - Results list with thread name, sender, highlighted snippet, timestamp
 * - Tap to navigate to the thread & message
 * - Recent searches stored in AsyncStorage (last 5)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import {
  useGlobalMessageSearch,
  type SearchResult,
} from '@/hooks/messaging/useGlobalMessageSearch';

const RECENT_SEARCHES_KEY = '@edudash_recent_msg_searches';
const MAX_RECENT = 5;

interface GlobalSearchModalProps {
  visible: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ visible, onClose }: GlobalSearchModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const { results, loading, query, setQuery, hasMore, loadMore } =
    useGlobalMessageSearch();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      loadRecent();
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      setQuery('');
    }
  }, [visible, setQuery]);

  const loadRecent = async () => {
    try {
      const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (raw) setRecentSearches(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  };

  const saveRecent = useCallback(async (term: string) => {
    try {
      const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      const existing: string[] = raw ? (JSON.parse(raw) as string[]) : [];
      const updated = [term, ...existing.filter((s) => s !== term)].slice(0, MAX_RECENT);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      setRecentSearches(updated);
    } catch {
      /* ignore */
    }
  }, []);

  const handleResultPress = useCallback(
    (item: SearchResult) => {
      Keyboard.dismiss();
      if (query.trim()) saveRecent(query.trim());
      onClose();
      router.push({
        pathname: '/(app)/messaging/chat/[threadId]' as const,
        params: { threadId: item.threadId, scrollToMessage: item.messageId },
      });
    },
    [query, saveRecent, onClose],
  );

  const handleRecentPress = useCallback(
    (term: string) => {
      setQuery(term);
    },
    [setQuery],
  );

  const formatTimestamp = (ts: string): string => {
    const d = new Date(ts);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const renderHighlight = (text: string): React.ReactNode => {
    if (!query.trim()) return text;
    const lower = text.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    if (idx === -1) return text;
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + query.length);
    const after = text.slice(idx + query.length);
    return (
      <Text>
        {before}
        <Text style={{ fontWeight: '700', color: theme.primary }}>{match}</Text>
        {after}
      </Text>
    );
  };

  const renderItem = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={[styles.resultItem, { borderBottomColor: theme.border }]}
      onPress={() => handleResultPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.resultTop}>
        <Text style={[styles.threadName, { color: theme.primary }]} numberOfLines={1}>
          {item.threadName}
        </Text>
        <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
          {formatTimestamp(item.timestamp)}
        </Text>
      </View>
      <Text style={[styles.senderName, { color: theme.text }]}>{item.senderName}</Text>
      <Text style={[styles.snippet, { color: theme.textSecondary }]} numberOfLines={2}>
        {renderHighlight(item.matchHighlight)}
      </Text>
    </TouchableOpacity>
  );

  const showEmpty = !loading && query.trim().length > 0 && results.length === 0;
  const showRecent = query.trim().length === 0 && recentSearches.length > 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        {/* Search bar */}
        <View style={[styles.searchBar, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={[styles.inputWrapper, { backgroundColor: theme.elevated }]}>
            <Ionicons name="search" size={18} color={theme.textSecondary} />
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: theme.text }]}
              placeholder="Search messages…"
              placeholderTextColor={theme.textSecondary}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Recent searches */}
        {showRecent && (
          <View style={styles.recentSection}>
            <Text style={[styles.recentTitle, { color: theme.textSecondary }]}>Recent Searches</Text>
            {recentSearches.map((term) => (
              <TouchableOpacity
                key={term}
                style={styles.recentItem}
                onPress={() => handleRecentPress(term)}
              >
                <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.recentText, { color: theme.text }]}>{term}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty state */}
        {showEmpty && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No messages found</Text>
          </View>
        )}

        {/* Default empty state (no query) */}
        {!showRecent && query.trim().length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Search messages across all your conversations
            </Text>
          </View>
        )}

        {/* Loading */}
        {loading && results.length === 0 && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        )}

        {/* Results */}
        {results.length > 0 && (
          <FlatList
            data={results}
            keyExtractor={(item) => item.messageId}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            onEndReached={hasMore ? loadMore : undefined}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loading ? <ActivityIndicator style={styles.footer} color={theme.primary} /> : null
            }
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  recentSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  recentTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  recentText: {
    fontSize: 15,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  loadingContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  resultItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  threadName: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 11,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  snippet: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    paddingVertical: 16,
  },
});
