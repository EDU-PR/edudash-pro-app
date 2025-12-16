import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLearnerCVs, useCreateCV } from '@/hooks/useLearnerData';

export default function LearnerCVScreen() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const { data: cvs, isLoading, error } = useLearnerCVs();
  const createCV = useCreateCV();

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: t('learner.my_cv', { defaultValue: 'My CV' }),
          headerBackTitle: t('common.back', { defaultValue: 'Back' }),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/screens/learner/cv-builder')}
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
              {t('common.error_loading', { defaultValue: 'Error loading CVs' })}
            </Text>
          </Card>
        )}

        {!isLoading && (!cvs || cvs.length === 0) && (
          <EmptyState
            icon="briefcase-outline"
            title={t('learner.no_cvs', { defaultValue: 'No CVs Yet' })}
            description={t('learner.cv_prompt', { defaultValue: 'Create your professional CV to showcase your skills and experience' })}
            actionLabel={t('learner.create_cv', { defaultValue: 'Create CV' })}
            onActionPress={() => router.push('/screens/learner/cv-builder')}
          />
        )}

        {cvs && cvs.map((cv) => (
          <Card key={cv.id} padding={16} margin={0} elevation="small" style={styles.cvCard}>
            <TouchableOpacity
              onPress={() => router.push(`/screens/learner/cv-detail?id=${cv.id}`)}
            >
              <View style={styles.cvHeader}>
                <View style={styles.cvInfo}>
                  <Text style={styles.cvTitle}>{cv.title}</Text>
                  <Text style={styles.cvDate}>
                    {t('learner.updated', { defaultValue: 'Updated' })}: {new Date(cv.updated_at).toLocaleDateString()}
                  </Text>
                </View>
                {cv.is_active && (
                  <View style={[styles.activeBadge, { backgroundColor: theme.success || '#10B981' }]}>
                    <Text style={styles.activeBadgeText}>{t('learner.active', { defaultValue: 'Active' })}</Text>
                  </View>
                )}
              </View>
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push(`/screens/learner/cv-detail?id=${cv.id}`)}
                >
                  <Ionicons name="eye-outline" size={20} color={theme.primary} />
                  <Text style={[styles.actionButtonText, { color: theme.primary }]}>
                    {t('common.view', { defaultValue: 'View' })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push(`/screens/learner/cv-builder?id=${cv.id}`)}
                >
                  <Ionicons name="create-outline" size={20} color={theme.textSecondary} />
                  <Text style={[styles.actionButtonText, { color: theme.textSecondary }]}>
                    {t('common.edit', { defaultValue: 'Edit' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Card>
        ))}

        {/* Create New CV Button */}
        {cvs && cvs.length > 0 && (
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push('/screens/learner/cv-builder')}
          >
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.createButtonText}>
              {t('learner.create_new_cv', { defaultValue: 'Create New CV' })}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme?.background || '#0b1220' },
  content: { padding: 16, paddingBottom: 32 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  cvCard: { marginBottom: 12 },
  cvHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cvInfo: { flex: 1 },
  cvTitle: { color: theme?.text || '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  cvDate: { color: theme?.textSecondary || '#9CA3AF', fontSize: 12 },
  activeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  footer: { flexDirection: 'row', gap: 16 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionButtonText: { fontSize: 14, fontWeight: '600' },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 16,
  },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorText: { color: theme?.error || '#EF4444', textAlign: 'center' },
});


