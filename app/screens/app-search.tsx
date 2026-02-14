import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  getFunctionSearchItems,
  type FunctionSearchItem,
  type FunctionSearchScope,
} from '@/lib/navigation/functionSearchIndex';

type SearchParams = {
  q?: string;
  scope?: string;
};

const QUICK_HINTS = ['dash', 'messages', 'uniforms', 'payments', 'documents', 'menu', 'finance', 'calendar'];

export default function AppSearchScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const params = useLocalSearchParams<SearchParams>();
  const initialQuery = typeof params?.q === 'string' ? params.q : '';
  const initialScope: FunctionSearchScope = params?.scope === 'dash' ? 'dash' : 'all';

  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<FunctionSearchScope>(initialScope);

  const results = useMemo(
    () => getFunctionSearchItems({ role: profile?.role, query, scope }),
    [profile?.role, query, scope],
  );

  const fallbackResults = useMemo(() => {
    if (scope !== 'dash') return [] as FunctionSearchItem[];
    if (query.trim().length === 0) return [] as FunctionSearchItem[];
    if (results.length > 0) return [] as FunctionSearchItem[];
    return getFunctionSearchItems({ role: profile?.role, query, scope: 'all' }).slice(0, 40);
  }, [profile?.role, query, results.length, scope]);

  const activeResults = results.length > 0 ? results : fallbackResults;

  const grouped = useMemo(() => {
    return activeResults.reduce<Record<string, FunctionSearchItem[]>>((acc, item) => {
      const key = item.section || 'General';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [activeResults]);

  const sections = useMemo(() => Object.entries(grouped), [grouped]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.title, { color: theme.text }]}>Find a Function</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Search app actions and jump directly
            </Text>
          </View>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Try: Dash Tutor, Uniforms, Messages..."
            placeholderTextColor={theme.textSecondary}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.trim().length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.scopeRow}>
          <TouchableOpacity
            style={[
              styles.scopeChip,
              { borderColor: theme.border, backgroundColor: scope === 'all' ? theme.primary + '22' : theme.surface },
            ]}
            onPress={() => setScope('all')}
          >
            <Text style={[styles.scopeChipText, { color: scope === 'all' ? theme.primary : theme.textSecondary }]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.scopeChip,
              { borderColor: theme.border, backgroundColor: scope === 'dash' ? theme.primary + '22' : theme.surface },
            ]}
            onPress={() => setScope('dash')}
          >
            <Text style={[styles.scopeChipText, { color: scope === 'dash' ? theme.primary : theme.textSecondary }]}>
              Dash AI
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.resultsScroll}
          contentContainerStyle={styles.resultsContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {results.length === 0 && fallbackResults.length > 0 && scope === 'dash' && (
            <View style={[styles.fallbackBanner, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Ionicons name="compass-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.fallbackBannerText, { color: theme.textSecondary }]}>
                No Dash-only match. Showing app-wide functions for this search.
              </Text>
            </View>
          )}

          {query.trim().length === 0 && (
            <View style={styles.hintRow}>
              {QUICK_HINTS.map((hint) => (
                <TouchableOpacity
                  key={hint}
                  style={[styles.hintChip, { borderColor: theme.border, backgroundColor: theme.surface }]}
                  onPress={() => setQuery(hint)}
                >
                  <Text style={[styles.hintChipText, { color: theme.textSecondary }]}>
                    {hint}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {sections.map(([section, items]) => (
            <View key={section} style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{section}</Text>
              {items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.resultCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  activeOpacity={0.75}
                  onPress={() => router.push(item.route as any)}
                >
                  <View style={[styles.iconWrap, { backgroundColor: theme.primary + '22' }]}>
                    <Ionicons name={item.icon as any} size={18} color={theme.primary} />
                  </View>
                  <View style={styles.resultMain}>
                    <Text style={[styles.resultTitle, { color: theme.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[styles.resultDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                      {item.description}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {activeResults.length === 0 && (
            <View style={[styles.emptyState, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Ionicons name="search-outline" size={24} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No matching function</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Try simpler terms like “Dash”, “messages”, “uniforms”, or “finance”.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
  },
  searchContainer: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 2,
  },
  scopeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  scopeChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  resultsScroll: {
    flex: 1,
    marginTop: 8,
  },
  resultsContent: {
    paddingBottom: 24,
  },
  hintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  hintChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hintChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fallbackBanner: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fallbackBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionBlock: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  resultMain: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  resultDescription: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
  },
  emptyState: {
    marginTop: 24,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
