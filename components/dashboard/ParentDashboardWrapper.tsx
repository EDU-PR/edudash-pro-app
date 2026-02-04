import React from 'react';
// Using refactored modular dashboard (320 lines vs 801 lines original)
import { NewEnhancedParentDashboard } from './NewEnhancedParentDashboardRefactored';

interface ParentDashboardWrapperProps {
  refreshTrigger?: number;
  focusSection?: string;
}

/**
 * Parent Dashboard Wrapper
 * 
 * Uses refactored modular dashboard with:
 * - Shared components: MetricCard, CollapsibleSection, SearchBar (PWA feature)
 * - Parent components: ChildSwitcher
 */
export const ParentDashboardWrapper: React.FC<ParentDashboardWrapperProps> = ({
  refreshTrigger,
  focusSection,
}) => {
  return (
    <NewEnhancedParentDashboard 
      refreshTrigger={refreshTrigger}
      focusSection={focusSection}
    />
  );
};

export default ParentDashboardWrapper;
