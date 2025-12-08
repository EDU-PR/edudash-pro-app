import React from 'react';
import { NewEnhancedTeacherDashboard } from './NewEnhancedTeacherDashboard';

interface TeacherDashboardWrapperProps {
  refreshTrigger?: number;
}

/**
 * Teacher Dashboard Wrapper
 * 
 * Simplified wrapper that renders the NewEnhanced dashboard.
 * Classic dashboard has been archived to ~/Desktop/edudashpro-classic-dashboards-archive/
 */
export const TeacherDashboardWrapper: React.FC<TeacherDashboardWrapperProps> = ({
  refreshTrigger
}) => {
  return (
    <NewEnhancedTeacherDashboard 
      refreshTrigger={refreshTrigger}
    />
  );
};

export default TeacherDashboardWrapper;
