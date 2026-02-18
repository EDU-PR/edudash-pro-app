import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useAuth } from '@/contexts/AuthContext';
import { WIDGET_COMPONENTS, type WidgetKey } from './cards';
import type { OrganizationType } from '@/lib/types/organization';
import { mark, measure } from '@/lib/perf';
import { track } from '@/lib/analytics';

import EduDashSpinner from '@/components/ui/EduDashSpinner';

/**
 * @deprecated Legacy dynamic widget router.
 * The active #NEXT-GEN flows use role + resolved school-type wrappers directly.
 */
interface DashboardRouterProps {
  /** Hub type to render (learner, guardian, instructor, admin, financial) */
  hubType: 'learner' | 'guardian' | 'instructor' | 'admin' | 'financial';
  /** Optional organization type override (defaults to user's org) */
  organizationType?: OrganizationType;
  /** Enable debug mode to show widget metadata */
  debug?: boolean;
}

/**
 * DashboardRouter dynamically renders dashboard widgets based on:
 * - User role and hub type
 * - Organization type
 * - User age group (child/teen/adult)
 * - Feature flags (environment + database)
 * 
 * @example
 * ```tsx
 * <DashboardRouter hubType="learner" />
 * ```
 */
export function DashboardRouter({
  hubType,
  organizationType,
  debug = false,
}: DashboardRouterProps) {
  const { profile } = useAuth();
  const firstRenderTrackedRef = useRef(false);

  useEffect(() => {
    if (firstRenderTrackedRef.current || !profile) return;
    firstRenderTrackedRef.current = true;
    mark('first_dashboard_render');
    const perf = measure('first_dashboard_render', 'app_start');
    track('edudash.app.first_dashboard_render', {
      duration_ms: perf.duration,
      hub_type: hubType,
      role: profile.role || null,
    });
  }, [profile, hubType]);

  // Determine effective organization type
  const effectiveOrgType = organizationType || (profile as any)?.preschool?.organization_type || 'preschool';

  // Static widget list — DashboardRegistry was never implemented
  const applicableWidgets = useMemo(() => {
    if (!profile) return [];

    // Return all available widget keys as basic entries
    return (Object.keys(WIDGET_COMPONENTS) as WidgetKey[]).map((key, idx) => ({
      id: key,
      name: key,
      component: key,
      displayOrder: idx,
      featureKey: null as string | null,
    }));
  }, [profile]);

  // Render loading state
  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <EduDashSpinner size="large" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  // Render empty state
  if (applicableWidgets.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No dashboard widgets available</Text>
        {debug && (
          <Text style={styles.debugText}>
            Hub: {hubType} | Org: {effectiveOrgType}
          </Text>
        )}
      </View>
    );
  }

  // Render widgets
  return (
    <View style={styles.container}>
      <FlashList
        data={applicableWidgets}
        renderItem={({ item }) => {
          const WidgetComponent = WIDGET_COMPONENTS[item.component as WidgetKey];
          
          if (!WidgetComponent) {
            console.warn(`Widget component not found: ${item.component}`);
            return null;
          }

          return (
            <View style={styles.widgetContainer}>
              <WidgetComponent />
              {debug && (
                <View style={styles.debugBadge}>
                  <Text style={styles.debugBadgeText}>
                    {item.name} | Order: {item.displayOrder} | Feature: {item.featureKey || 'none'}
                  </Text>
                </View>
              )}
            </View>
          );
        }}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  widgetContainer: {
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  debugText: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  debugBadge: {
    marginTop: 4,
    padding: 4,
    backgroundColor: '#ffeb3b',
    borderRadius: 4,
  },
  debugBadgeText: {
    fontSize: 10,
    color: '#000',
    fontFamily: 'monospace',
  },
});
