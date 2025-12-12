import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useOrgPrograms } from '@/hooks/useOrgPrograms';
import { EnrollmentInviteModal } from '@/components/org-admin/EnrollmentInviteModal';
import { ProgramCodeShareModal } from '@/components/org-admin/ProgramCodeShareModal';

export default function ProgramsScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { data: programs, isLoading } = useOrgPrograms();
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<string | undefined>();
  const [selectedProgram, setSelectedProgram] = useState<any>(null);
  const styles = createStyles(theme);

  const handleInviteToProgram = (programId: string) => {
    setSelectedProgramId(programId);
    setInviteModalVisible(true);
  };

  const handleShareProgram = (program: any) => {
    setSelectedProgram(program);
    setShareModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen 
        options={{ 
          title: 'Programs',
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
          headerTintColor: theme.primary,
        }} 
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Training Programs</Text>
          <Text style={styles.subtitle}>
            Manage programs, learnerships, and courses
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading programs...
            </Text>
          </View>
        ) : programs && programs.length > 0 ? (
          <View style={styles.programList}>
            {programs.map((program) => (
              <View key={program.id} style={[styles.programCard, { 
                backgroundColor: theme.card,
                borderColor: theme.border,
              }]}>
                <View style={styles.programHeader}>
                  <View style={styles.programTitleRow}>
                    <Text style={[styles.programTitle, { color: theme.text }]}>
                      {program.title}
                    </Text>
                    {!program.is_active && (
                      <View style={[styles.badge, { backgroundColor: theme.error }]}>
                        <Text style={styles.badgeText}>Inactive</Text>
                      </View>
                    )}
                  </View>
                  {program.course_code && (
                    <Text style={[styles.courseCode, { color: theme.textSecondary }]}>
                      {program.course_code}
                    </Text>
                  )}
                </View>

                {program.description && (
                  <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
                    {program.description}
                  </Text>
                )}

                <View style={styles.programMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="person-outline" size={16} color={theme.textSecondary} />
                    <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                      {program.instructor 
                        ? `${program.instructor.first_name || ''} ${program.instructor.last_name || ''}`.trim()
                        : 'No instructor'
                      }
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="people-outline" size={16} color={theme.textSecondary} />
                    <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                      {program.enrollment_count} enrolled
                      {program.max_students && ` / ${program.max_students} max`}
                    </Text>
                  </View>
                </View>

                <View style={styles.programActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, { 
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                    }]}
                    onPress={() => handleShareProgram(program)}
                  >
                    <Ionicons name="share-social-outline" size={18} color={theme.primary} />
                    <Text style={[styles.actionButtonText, { color: theme.primary }]}>
                      Share & Get Code
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, { 
                      backgroundColor: theme.primary,
                    }]}
                    onPress={() => handleInviteToProgram(program.id)}
                  >
                    <Ionicons name="mail-outline" size={18} color="#fff" />
                    <Text style={[styles.actionButtonText, { color: '#fff' }]}>
                      Invite
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="school-outline" size={64} color={theme.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No Programs Yet
            </Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Create your first training program or learnership to get started.
            </Text>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: theme.primary }]}
              onPress={() => {
                // TODO: Navigate to create program
              }}
            >
              <Text style={styles.buttonText}>Create Program</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <EnrollmentInviteModal
        visible={inviteModalVisible}
        onClose={() => {
          setInviteModalVisible(false);
          setSelectedProgramId(undefined);
        }}
        theme={theme}
        programId={selectedProgramId}
      />

      {selectedProgram && (
        <ProgramCodeShareModal
          visible={shareModalVisible}
          onClose={() => {
            setShareModalVisible(false);
            setSelectedProgram(null);
          }}
          theme={theme}
          program={selectedProgram}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: theme.background 
  },
  content: { 
    padding: 16, 
    gap: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 8,
  },
  title: {
    color: theme.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  programList: {
    gap: 12,
  },
  programCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  programHeader: {
    gap: 4,
  },
  programTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  programTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  courseCode: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  programMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
  },
  programActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 20,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

