import React, { memo } from 'react';
// Using refactored modular dashboard (317 lines vs 1,518 lines original)
import { NewEnhancedPrincipalDashboard } from './NewEnhancedPrincipalDashboardRefactored';

interface PrincipalDashboardWrapperProps {
  refreshTrigger?: number;
}

/**
 * Principal Dashboard Wrapper
 * 
 * Uses refactored modular dashboard with extracted components:
 * - PrincipalWelcomeSection, PrincipalMetricsSection
 * - PrincipalQuickActions, PrincipalRecentActivity
 * - Shared: MetricCard, QuickActionCard, CollapsibleSection, SearchBar
 */
const PrincipalDashboardWrapperComponent: React.FC<PrincipalDashboardWrapperProps> = ({
  refreshTrigger
}) => {
  return (
    <NewEnhancedPrincipalDashboard 
      refreshTrigger={refreshTrigger}
    />
  );
};

// Memoize wrapper to prevent unnecessary re-renders
export const PrincipalDashboardWrapper = memo(
  PrincipalDashboardWrapperComponent,
  (prevProps, nextProps) => prevProps.refreshTrigger === nextProps.refreshTrigger
);
