import type { TestResult, TestSuite } from '@/lib/screen-styles/super-admin-system-test.styles';
import type { AlertButton } from '@/components/ui/AlertModal';

// Re-export for consumers
export type { TestResult, TestSuite };

// ── Hook interface ─────────────────────────────────────────────────────────

export interface UseSuperAdminSystemTestParams {
  showAlert: (opts: {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    buttons?: AlertButton[];
  }) => void;
}

export interface UseSuperAdminSystemTestReturn {
  loading: boolean;
  testSuites: TestSuite[];
  runningAllTests: boolean;
  overallStatus: 'idle' | 'running' | 'completed';
  runTestSuite: (suiteId: string) => Promise<void>;
  runAllTests: () => Promise<void>;
}

// ── Initial test-suite definitions ─────────────────────────────────────────

export const INITIAL_TEST_SUITES: TestSuite[] = [
  {
    id: 'auth_rls',
    name: 'Authentication & RLS Tests',
    description: 'Validate authentication and Row Level Security policies',
    status: 'pending',
    tests: [
      {
        id: 'is_superadmin_check',
        name: 'Super Admin Role Check',
        description: 'Verify is_superadmin() function works correctly',
        status: 'pending',
      },
      {
        id: 'rls_policies_check',
        name: 'RLS Policies Validation',
        description: 'Check that RLS policies are properly configured',
        status: 'pending',
      },
      {
        id: 'access_control_check',
        name: 'Access Control Validation',
        description: 'Verify proper access control for superadmin functions',
        status: 'pending',
      },
    ],
  },
  {
    id: 'database_functions',
    name: 'Database RPC Functions',
    description: 'Test all superadmin RPC functions',
    status: 'pending',
    tests: [
      {
        id: 'dashboard_data_test',
        name: 'Dashboard Data Function',
        description: 'Test get_superadmin_dashboard_data() function',
        status: 'pending',
      },
      {
        id: 'system_test_function',
        name: 'System Test Function',
        description: 'Test test_superadmin_system() function',
        status: 'pending',
      },
      {
        id: 'user_management_functions',
        name: 'User Management Functions',
        description: 'Test suspend, reactivate, and role update functions',
        status: 'pending',
      },
      {
        id: 'user_deletion_function',
        name: 'User Deletion Function',
        description: 'Test superadmin_request_user_deletion() function',
        status: 'pending',
      },
    ],
  },
  {
    id: 'ui_components',
    name: 'UI Components Tests',
    description: 'Validate UI components and navigation',
    status: 'pending',
    tests: [
      {
        id: 'dashboard_rendering',
        name: 'Dashboard Rendering',
        description: 'Check superadmin dashboard loads correctly',
        status: 'pending',
      },
      {
        id: 'user_management_ui',
        name: 'User Management UI',
        description: 'Verify user management screen functionality',
        status: 'pending',
      },
      {
        id: 'ai_quotas_ui',
        name: 'AI Quotas UI',
        description: 'Check AI quota management screen',
        status: 'pending',
      },
      {
        id: 'system_monitoring_ui',
        name: 'System Monitoring UI',
        description: 'Validate system monitoring dashboard',
        status: 'pending',
      },
    ],
  },
  {
    id: 'end_to_end',
    name: 'End-to-End Tests',
    description: 'Complete workflow tests',
    status: 'pending',
    tests: [
      {
        id: 'user_workflow',
        name: 'User Management Workflow',
        description: 'Test complete user management workflow',
        status: 'pending',
      },
      {
        id: 'audit_logging',
        name: 'Audit Logging',
        description: 'Verify audit logs are created properly',
        status: 'pending',
      },
      {
        id: 'error_handling',
        name: 'Error Handling',
        description: 'Test error handling and edge cases',
        status: 'pending',
      },
    ],
  },
];
