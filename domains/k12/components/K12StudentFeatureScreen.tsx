import React from 'react';
import { ScrollView, ActivityIndicator } from 'react-native';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNextGenTheme } from '@/contexts/K12NextGenThemeContext';
import { GlassCard } from '@/components/nextgen/GlassCard';
import { GradientActionCard } from '@/components/nextgen/GradientActionCard';

export interface FeatureItem {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: string;
}

interface K12StudentFeatureScreenProps {
  title: string;
  subtitle: string;
  heroTitle: string;
  heroDescription: string;
  heroCta: string;
  heroIcon?: keyof typeof Ionicons.glyphMap;
  heroTone?: 'green' | 'purple';
  onHeroPress: () => void;
  items: FeatureItem[];
  loading?: boolean;
  emptyMessage?: string;
}

export function K12StudentFeatureScreen({
  title,
  subtitle,
  heroTitle,
  heroDescription,
  heroCta,
  heroIcon = 'school-outline',
  heroTone = 'green',
  onHeroPress,
  items,
  loading = false,
  emptyMessage = 'Nothing here yet.',
}: K12StudentFeatureScreenProps) {
  const { theme } = useNextGenTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerTextBlock}>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
          </View>
        </View>

        <GradientActionCard
          tone={heroTone}
          icon={heroIcon}
          badgeLabel="K-12"
          title={heroTitle}
          description={heroDescription}
          cta={heroCta}
          onPress={onHeroPress}
        />

        <View style={styles.listSection}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Loading…</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="folder-open-outline" size={32} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{emptyMessage}</Text>
            </View>
          ) : (
            items.map((item) => (
              <GlassCard key={item.id} style={styles.itemCard} padding={14}>
                <View style={styles.itemRow}>
                  <View style={[styles.itemIcon, { backgroundColor: `${item.tone || theme.primary}20` }]}>
                    <Ionicons name={item.icon} size={18} color={item.tone || theme.primary} />
                  </View>
                  <View style={styles.itemText}>
                    <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
                    <Text style={[styles.itemSubtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text>
                  </View>
                </View>
              </GlassCard>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 36,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextBlock: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  listSection: {
    gap: 10,
  },
  itemCard: {
    borderRadius: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemSubtitle: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default K12StudentFeatureScreen;
