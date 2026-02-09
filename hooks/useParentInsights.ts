/**
 * useParentInsights
 *
 * Hook to fetch proactive AI-powered insights for the active child.
 * Wraps ProactiveInsightsService, caches results, and auto-refreshes.
 *
 * ≤200 lines (WARP-compliant)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import {
  ProactiveInsightsService,
  type ProactiveInsight,
  type PredictiveAlert,
} from '@/services/ProactiveInsightsService';

interface UseParentInsightsOptions {
  /** Currently focused student ID */
  studentId: string | null;
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
  /** Include predictive alerts (default: true) */
  includeAlerts?: boolean;
}

interface UseParentInsightsReturn {
  insights: ProactiveInsight[];
  alerts: PredictiveAlert[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Whether any high-priority insight/alert exists */
  hasUrgent: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  insights: ProactiveInsight[];
  alerts: PredictiveAlert[];
  timestamp: number;
}

const insightsCache = new Map<string, CacheEntry>();

export function useParentInsights({
  studentId,
  autoFetch = true,
  includeAlerts = true,
}: UseParentInsightsOptions): UseParentInsightsReturn {
  const { profile } = useAuth();
  const [insights, setInsights] = useState<ProactiveInsight[]>([]);
  const [alerts, setAlerts] = useState<PredictiveAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const preschoolId = profile?.preschool_id || profile?.organization_id;

  const fetchInsights = useCallback(async () => {
    if (!studentId || !preschoolId) {
      setInsights([]);
      setAlerts([]);
      return;
    }

    // Check cache
    const cacheKey = `${preschoolId}:${studentId}`;
    const cached = insightsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setInsights(cached.insights);
      setAlerts(cached.alerts);
      return;
    }

    abortRef.current = false;
    setLoading(true);
    setError(null);

    try {
      const service = new ProactiveInsightsService(preschoolId);

      const [insightResults, alertResults] = await Promise.all([
        service.generateProactiveInsights(studentId),
        includeAlerts
          ? service.generatePredictiveAlerts(studentId, preschoolId)
          : Promise.resolve([]),
      ]);

      if (abortRef.current) return;

      setInsights(insightResults);
      setAlerts(alertResults);

      // Update cache
      insightsCache.set(cacheKey, {
        insights: insightResults,
        alerts: alertResults,
        timestamp: Date.now(),
      });
    } catch (err) {
      if (abortRef.current) return;
      const message =
        err instanceof Error ? err.message : 'Failed to load insights';
      logger.error('[useParentInsights] Error:', err);
      setError(message);
    } finally {
      if (!abortRef.current) {
        setLoading(false);
      }
    }
  }, [studentId, preschoolId, includeAlerts]);

  // Auto-fetch when student changes
  useEffect(() => {
    if (autoFetch) {
      fetchInsights();
    }
    return () => {
      abortRef.current = true;
    };
  }, [fetchInsights, autoFetch]);

  const hasUrgent =
    insights.some((i) => i.priority === 'high') ||
    alerts.some((a) => a.severity === 'urgent');

  return {
    insights,
    alerts,
    loading,
    error,
    refresh: fetchInsights,
    hasUrgent,
  };
}
