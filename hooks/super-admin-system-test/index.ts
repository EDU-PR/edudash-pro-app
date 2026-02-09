import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { track } from '@/lib/analytics';

import type {
  TestSuite,
  UseSuperAdminSystemTestParams,
  UseSuperAdminSystemTestReturn,
} from './types';
import { INITIAL_TEST_SUITES } from './types';
import { runSingleTest } from './testRunner';

export type { TestResult, TestSuite } from './types';

/**
 * Hook encapsulating all state & logic for the Super-Admin System Test screen.
 * Accepts `showAlert` so the screen controls the modal.
 */
export function useSuperAdminSystemTest({
  showAlert,
}: UseSuperAdminSystemTestParams): UseSuperAdminSystemTestReturn {
  const { profile } = useAuth();

  const [loading] = useState(false);
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [runningAllTests, setRunningAllTests] = useState(false);
  const [overallStatus, setOverallStatus] =
    useState<'idle' | 'running' | 'completed'>('idle');

  // Seed the suites on mount
  useEffect(() => {
    setTestSuites(INITIAL_TEST_SUITES);
  }, []);

  // ── Run a single suite ───────────────────────────────────────────────────

  const runTestSuite = useCallback(
    async (suiteId: string) => {
      const suite = testSuites.find((s) => s.id === suiteId);
      if (!suite) return;

      // Mark suite running
      setTestSuites((prev) =>
        prev.map((s) =>
          s.id === suiteId
            ? { ...s, status: 'running', startTime: Date.now() }
            : s,
        ),
      );

      for (const test of suite.tests) {
        // Mark individual test running
        setTestSuites((prev) =>
          prev.map((s) =>
            s.id === suiteId
              ? {
                  ...s,
                  tests: s.tests.map((t) =>
                    t.id === test.id ? { ...t, status: 'running' } : t,
                  ),
                }
              : s,
          ),
        );

        const result = await runSingleTest(test.id, profile?.role);

        // Store result
        setTestSuites((prev) =>
          prev.map((s) =>
            s.id === suiteId
              ? {
                  ...s,
                  tests: s.tests.map((t) =>
                    t.id === test.id ? result : t,
                  ),
                }
              : s,
          ),
        );

        // Small delay between tests
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Mark suite completed
      setTestSuites((prev) =>
        prev.map((s) =>
          s.id === suiteId
            ? { ...s, status: 'completed', endTime: Date.now() }
            : s,
        ),
      );
    },
    [testSuites, profile?.role],
  );

  // ── Run every suite sequentially ─────────────────────────────────────────

  const runAllTests = useCallback(async () => {
    setRunningAllTests(true);
    setOverallStatus('running');

    for (const suite of testSuites) {
      await runTestSuite(suite.id);
    }

    setRunningAllTests(false);
    setOverallStatus('completed');

    track('superadmin_system_test_completed', {
      total_suites: testSuites.length,
      total_tests: testSuites.reduce(
        (acc, suite) => acc + suite.tests.length,
        0,
      ),
    });

    showAlert({
      title: 'Tests Complete',
      message:
        'All superadmin system tests have been executed. Check the results below.',
      buttons: [{ text: 'OK', style: 'default' }],
    });
  }, [testSuites, runTestSuite, showAlert]);

  return {
    loading,
    testSuites,
    runningAllTests,
    overallStatus,
    runTestSuite,
    runAllTests,
  };
}
