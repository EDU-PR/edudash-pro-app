import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLearnerPortfolio } from '@/hooks/useLearnerData';

export default function LearnerPortfolioScreen() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const { data: portfolio, isLoading, error } = useLearnerPortfolio();

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: t('learner.portfolio', { defaultValue: 'My Portfolio' }),
          headerBackTitle: t('common.back', { defaultValue: 'Back' }),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/screens/learner/portfolio-add')}
              style={{ marginRight: 16 }}
            >
              <Ionicons name="add-circle-outline" size={28} color={theme.primary} />
            </TouchableOpacity>
          ),
        }} 
      />
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading && (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        )}

        {error && (
          <Card padding={20} margin={0}>
            <Text style={styles.errorText}>
              {t('common.error_loading', { defaultValue: 'Error loading portfolio' })}
            </Text>
          </Card>
        )}

        {!isLoading && (!portfolio || portfolio.length === 0) && (
          <EmptyState
            icon="folder-outline"
            title={t('learner.no_portfolio', { defaultValue: 'No Portfolio Items Yet' })}
            description={t('learner.portfolio_prompt', { defaultValue: 'Add projects, certificates, and achievements to showcase your work' })}
            actionLabel={t('learner.add_item', { defaultValue: 'Add Item' })}
            onActionPress={() => router.push('/screens/learner/portfolio-add')}
          />
        )}

        {portfolio && portfolio.map((item) => (
          <Card key={item.id} padding={16} margin={0} elevation="small" style={styles.portfolioCard}>
            <TouchableOpacity
              onPress={() => router.push(`/screens/learner/portfolio-detail?id=${item.id}`)}
            >
              <View style={styles.portfolioHeader}>
                <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.item_type, theme) }]}>
                  <Ionicons name={getTypeIcon(item.item_type)} size={20} color="#fff" />
                </View>
                <View style={styles.portfolioInfo}>
                  <Text style={styles.portfolioTitle}>{item.title}</Text>
                  <Text style={styles.portfolioType}>{getTypeLabel(item.item_type, t)}</Text>
                </View>
              </View>
              {item.description && (
                <Text style={styles.portfolioDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              {item.tags && item.tags.length > 0 && (
                <View style={styles.tagsContainer}>
                  {item.tags.slice(0, 3).map((tag, index) => (
                    <View key={index} style={[styles.tag, { backgroundColor: theme.surface }]}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.footer}>
                <Text style={styles.date}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </View>
            </TouchableOpacity>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

function getTypeIcon(type: string): any {
  switch (type) {
    case 'project':
      return 'code-working-outline';
    case 'certificate':
      return 'ribbon-outline';
    case 'achievement':
      return 'trophy-outline';
    case 'work_sample':
      return 'document-text-outline';
    default:
      return 'folder-outline';
  }
}

function getTypeLabel(type: string, t: any): string {
  switch (type) {
    case 'project':
      return t('learner.project', { defaultValue: 'Project' });
    case 'certificate':
      return t('learner.certificate', { defaultValue: 'Certificate' });
    case 'achievement':
      return t('learner.achievement', { defaultValue: 'Achievement' });
    case 'work_sample':
      return t('learner.work_sample', { defaultValue: 'Work Sample' });
    default:
      return type;
  }
}

function getTypeColor(type: string, theme: any): string {
  switch (type) {
    case 'project':
      return theme.primary;
    case 'certificate':
      return theme.success || '#10B981';
    case 'achievement':
      return theme.warning || '#F59E0B';
    case 'work_sample':
      return theme.info || '#3B82F6';
    default:
      return theme.textSecondary;
  }
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme?.background || '#0b1220' },
  content: { padding: 16, paddingBottom: 32 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  portfolioCard: { marginBottom: 12 },
  portfolioHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  typeBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  portfolioInfo: { flex: 1 },
  portfolioTitle: { color: theme?.text || '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  portfolioType: { color: theme?.textSecondary || '#9CA3AF', fontSize: 13 },
  portfolioDescription: { color: theme?.textSecondary || '#9CA3AF', fontSize: 14, marginBottom: 12 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagText: { color: theme?.text, fontSize: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { color: theme?.textSecondary || '#9CA3AF', fontSize: 12 },
  errorText: { color: theme?.error || '#EF4444', textAlign: 'center' },
});






