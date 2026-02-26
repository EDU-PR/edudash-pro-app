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
import type { ThemeColors } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { useTranslation } from 'react-i18next';
import { extractOrganizationId } from '@/lib/tenant/compat';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';

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
  const { showAlert, alertProps } = useAlertModal();
  
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
    updatePlan,
  } = useAIYearPlanner({ organizationId: orgId, userId: user?.id, onShowAlert: showAlert });
  
  // Modal state
  const [showConfigModal, setShowConfigModal] = useState(false);

  const content = (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      
      {/* Compact header: icon + title inline, generate CTA only when needed */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.aiIconSmall}>
            <Ionicons name="sparkles" size={18} color="#8B5CF6" />
          </View>
          <Text style={styles.headerTitle}>AI Year Planner</Text>
          {!generatedPlan && !isGenerating && (
            <TouchableOpacity
              style={styles.generateButtonCompact}
              onPress={() => setShowConfigModal(true)}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.generateButtonText}>Generate</Text>
            </TouchableOpacity>
          )}
        </View>
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
          onUpdatePlan={updatePlan}
        />
      )}
      
      {/* Configuration Modal */}
      <YearPlanConfigModal
        visible={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onGenerate={generateYearPlan}
      />
      <AlertModal {...alertProps} />
    </View>
  );

  return (
    <DesktopLayout
      role="principal"
      title="AI Year Planner"
      showBackButton
      mobileHeaderTopInsetOffset={4}
    >
      {content}
    </DesktopLayout>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      backgroundColor: theme.card,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    aiIconSmall: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: '#8B5CF620',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    generateButtonCompact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#8B5CF6',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
    },
    generateButtonText: {
      color: '#fff',
      fontSize: 14,
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
