// filepath: /media/king/5e026cdc-594e-4493-bf92-c35c231beea3/home/king/Desktop/dashpro/app/screens/principal-ai-year-planner.tsx
/**
 * Principal AI Year Planner Screen (Native)
 * 
 * AI-assisted year planning for principals who need help planning
 * their academic year with themes, excursions, meetings, and activities.
 * 
 * Refactored to use extracted components per WARP.md standards.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { useTranslation } from 'react-i18next';
import { extractOrganizationId } from '@/lib/tenant/compat';

// Extracted components and hooks
import {
  YearPlanConfigModal,
  GeneratedPlanView,
} from '@/components/principal/ai-planner';
import { useAIYearPlanner } from '@/hooks/principal/useAIYearPlanner';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
export default function PrincipalAIYearPlannerScreen() {
  const { theme } = useTheme();
  const { profile, user } = useAuth();
  const { t } = useTranslation();
  const styles = createStyles(theme);
  
  const orgId = extractOrganizationId(profile);
  
  // Use extracted hook for AI planner logic
  const {
    generatedPlan,
    isGenerating,
    isSaving,
    expandedTerm,
    setExpandedTerm,
    generateYearPlan,
    savePlanToDatabase,
  } = useAIYearPlanner({ organizationId: orgId, userId: user?.id });
  
  // Modal state
  const [showConfigModal, setShowConfigModal] = useState(false);

  const content = (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'AI Year Planner',
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
        }}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.aiIconContainer}>
            <Ionicons name="sparkles" size={32} color="#8B5CF6" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>AI Year Planner</Text>
            <Text style={styles.headerSubtitle}>
              Let AI help you create a comprehensive academic year plan
            </Text>
          </View>
        </View>
        
        {!generatedPlan && !isGenerating && (
          <TouchableOpacity
            style={styles.generateButton}
            onPress={() => setShowConfigModal(true)}
          >
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.generateButtonText}>Generate Year Plan</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Loading State */}
      {isGenerating && (
        <View style={styles.loadingContainer}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Generating your year plan...</Text>
          <Text style={styles.loadingSubtext}>This may take a moment</Text>
        </View>
      )}
      
      {/* Generated Plan */}
      {generatedPlan && !isGenerating && (
        <GeneratedPlanView
          plan={generatedPlan}
          expandedTerm={expandedTerm}
          isSaving={isSaving}
          onToggleExpandTerm={setExpandedTerm}
          onSave={savePlanToDatabase}
          onRegenerate={() => setShowConfigModal(true)}
        />
      )}
      
      {/* Configuration Modal */}
      <YearPlanConfigModal
        visible={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onGenerate={generateYearPlan}
      />
    </View>
  );

  return <DesktopLayout role="principal">{content}</DesktopLayout>;
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      backgroundColor: theme.card,
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    aiIconContainer: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: '#8B5CF620',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    headerText: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
    },
    generateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#8B5CF6',
      paddingVertical: 14,
      borderRadius: 12,
    },
    generateButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginTop: 16,
    },
    loadingSubtext: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
    },
  });
