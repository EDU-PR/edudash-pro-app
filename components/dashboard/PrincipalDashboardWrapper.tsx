import React, { memo, useState, useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
// Using refactored modular dashboard (317 lines vs 1,518 lines original)
import { NewEnhancedPrincipalDashboard } from './NewEnhancedPrincipalDashboardRefactored';
import { K12AdminDashboard } from './K12AdminDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';

// EduDash Pro Community School is a K-12 school (not a preschool)
const K12_SCHOOL_IDS = [
  '00000000-0000-0000-0000-000000000001', // EduDash Pro Community School
];

interface PrincipalDashboardWrapperProps {
  refreshTrigger?: number;
}

/**
 * Principal Dashboard Wrapper
 * 
 * Routes to appropriate dashboard based on organization type:
 * - K-12 Schools → K12AdminDashboard (grade-based, aftercare focused)
 * - Preschools → NewEnhancedPrincipalDashboard (early childhood focused)
 * 
 * Uses refactored modular dashboard with extracted components:
 * - PrincipalWelcomeSection, PrincipalMetricsSection
 * - PrincipalQuickActions, PrincipalRecentActivity
 * - Shared: MetricCard, QuickActionCard, CollapsibleSection, SearchBar
 */
const PrincipalDashboardWrapperComponent: React.FC<PrincipalDashboardWrapperProps> = ({
  refreshTrigger
}) => {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const [orgType, setOrgType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const organizationId = profile?.organization_id || profile?.preschool_id;
  
  // Check if this is a K-12 school by ID (fast path)
  const isK12ById = organizationId && K12_SCHOOL_IDS.includes(organizationId);
  
  // For non-hardcoded schools, check the organizations table
  useEffect(() => {
    const checkOrgType = async () => {
      if (!organizationId) {
        setLoading(false);
        return;
      }
      
      // Fast path: known K-12 schools
      if (isK12ById) {
        setOrgType('k12_school');
        setLoading(false);
        return;
      }
      
      // Check organizations table for type
      try {
        const supabase = assertSupabase();
        const { data, error } = await supabase
          .from('organizations')
          .select('type')
          .eq('id', organizationId)
          .single();
        
        if (!error && data?.type) {
          setOrgType(data.type);
        } else {
          // Default to preschool if not found
          setOrgType('preschool');
        }
      } catch (e) {
        console.debug('[DashboardWrapper] Org type check failed, defaulting to preschool');
        setOrgType('preschool');
      } finally {
        setLoading(false);
      }
    };
    
    checkOrgType();
  }, [organizationId, isK12ById]);
  
  // Show loading while checking org type
  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading dashboard...
        </Text>
      </View>
    );
  }
  
  // Route to K-12 dashboard for K-12 schools
  if (orgType === 'k12_school' || isK12ById) {
    return <K12AdminDashboard />;
  }
  
  // Default: Preschool dashboard
  return (
    <NewEnhancedPrincipalDashboard 
      refreshTrigger={refreshTrigger}
    />
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
});

// Memoize wrapper to prevent unnecessary re-renders
export const PrincipalDashboardWrapper = memo(
  PrincipalDashboardWrapperComponent,
  (prevProps, nextProps) => prevProps.refreshTrigger === nextProps.refreshTrigger
);
