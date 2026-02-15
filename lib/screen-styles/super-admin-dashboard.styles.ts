import { StyleSheet } from 'react-native';

// ── Types / Interfaces ──────────────────────────────────────────────

export interface DashboardStats {
  total_users: number;
  active_users: number;
  total_organizations: number;
  active_seats: number;
  monthly_revenue: number;
  ai_usage_cost: number;
  system_health: 'healthy' | 'degraded' | 'down';
  pending_issues: number;
}

export interface RecentAlert {
  id: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  timestamp: string;
}

export interface SystemStatus {
  database: { status: string; color: string; };
  api: { status: string; color: string; };
  security: { status: string; color: string; };
}

export interface FeatureFlag {
  name: string;
  percentage: number;
  color: string;
  enabled: boolean;
}

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
  badge?: number;
}

// ── Style Factory ───────────────────────────────────────────────────

export function createStyles(theme: any) {
  const bg0 = theme?.background ?? '#0F121E';
  const glass = 'rgba(255,255,255,0.06)';
  const glassBorder = 'rgba(255,255,255,0.12)';
  const glassStrong = 'rgba(255,255,255,0.085)';
  const glassHighlight = 'rgba(255,255,255,0.20)';

  const glassShadow = {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.35,
    shadowRadius: 26,
    elevation: 14,
  };

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: bg0,
    },
    bgLayer: {
      ...StyleSheet.absoluteFillObject,
    },
    bgBlobA: {
      position: 'absolute',
      top: -120,
      right: -140,
      width: 340,
      height: 340,
      borderRadius: 999,
      backgroundColor: `${theme?.primary ?? '#8b5cf6'}22`,
      transform: [{ rotate: '18deg' }],
    },
    bgBlobB: {
      position: 'absolute',
      bottom: -160,
      left: -160,
      width: 380,
      height: 380,
      borderRadius: 999,
      backgroundColor: `${theme?.accent ?? '#22c55e'}14`,
      transform: [{ rotate: '-10deg' }],
    },
    bgBlobC: {
      position: 'absolute',
      top: 220,
      left: -120,
      width: 260,
      height: 260,
      borderRadius: 999,
      backgroundColor: `${theme?.primary ?? '#8b5cf6'}10`,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      textAlign: 'center',
    },
    accessDeniedContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    accessDeniedText: {
      fontSize: 24,
      fontWeight: '700',
      marginTop: 16,
      marginBottom: 8,
      textAlign: 'center',
    },
    accessDeniedSubtext: {
      fontSize: 16,
      marginBottom: 16,
      textAlign: 'center',
    },
    debugText: {
      fontSize: 12,
      marginBottom: 24,
      textAlign: 'center',
    },
    signOutButton: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    signOutButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    quickAccessBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      backgroundColor: glassStrong,
      borderBottomColor: glassBorder,
    },
    quickAccessLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexShrink: 1,
    },
    aiButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
    },
    opsConsoleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: glass,
      borderWidth: 1,
      borderColor: glassBorder,
      borderTopColor: glassHighlight,
      borderTopWidth: 1,
    },
    opsConsoleText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '600',
    },
    aiButtonText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '600',
    },
    titleText: {
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 24,
    },
    subtitleText: {
      fontSize: 13,
      fontWeight: '400',
      marginTop: 2,
      opacity: 0.7,
    },
    healthIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      gap: 6,
      alignSelf: 'flex-start',
    },
    healthText: {
      fontSize: 11,
      fontWeight: '500',
    },
    content: {
      flex: 1,
    },
    statsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 16,
      marginBottom: 24,
      gap: 8,
      justifyContent: 'space-between',
    },
    statCard: {
      width: '48%',
      padding: 14,
      borderRadius: 12,
      alignItems: 'center',
      minHeight: 110,
      justifyContent: 'center',
      marginBottom: 8,
      backgroundColor: glass,
      borderWidth: 1,
      borderColor: glassBorder,
      borderTopColor: glassHighlight,
      borderTopWidth: 1,
      overflow: 'hidden',
      ...glassShadow,
    },
    statValue: {
      fontSize: 24,
      fontWeight: '700',
      marginTop: 8,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
      textAlign: 'center',
    },
    statSubtext: {
      fontSize: 12,
      textAlign: 'center',
    },
    section: {
      paddingHorizontal: 16,
      marginBottom: 28,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 6,
      lineHeight: 24,
    },
    sectionSubtitle: {
      fontSize: 13,
      marginBottom: 18,
      fontStyle: 'normal',
      lineHeight: 18,
    },
    aiControlCard: {
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      backgroundColor: glass,
      borderColor: glassBorder,
      borderTopColor: glassHighlight,
      borderTopWidth: 1,
      overflow: 'hidden',
      ...glassShadow,
    },
    aiControlHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    aiControlOwnerInfo: {
      flex: 1,
    },
    aiControlTitle: {
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 4,
    },
    aiControlSubtext: {
      fontSize: 12,
      lineHeight: 16,
    },
    aiOwnerButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    aiOwnerButtonText: {
      fontSize: 12,
      fontWeight: '700',
    },
    aiOwnerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 32,
      minWidth: 110,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1.5,
    },
    aiOwnerBadgeText: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    aiControlDivider: {
      height: 1,
      marginVertical: 12,
    },
    aiControlRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
    },
    aiControlInfo: {
      flex: 1,
      paddingRight: 12,
    },
    aiControlLabel: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    },
    aiControlHint: {
      fontSize: 12,
      lineHeight: 16,
    },
    aiModeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 4,
    },
    aiModeButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    aiModeButtonText: {
      fontSize: 12,
      fontWeight: '600',
    },
    aiControlNote: {
      fontSize: 12,
      marginTop: 8,
      fontStyle: 'italic',
    },
    aiPresetRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    aiPresetButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    aiPresetButtonText: {
      fontSize: 12,
      fontWeight: '600',
    },
    passwordOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    passwordCard: {
      width: '100%',
      maxWidth: 360,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
    },
    passwordTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 6,
    },
    passwordMessage: {
      fontSize: 13,
      marginBottom: 14,
      lineHeight: 18,
    },
    passwordInput: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
    },
    passwordError: {
      marginTop: 8,
      fontSize: 12,
    },
    passwordActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 16,
    },
    passwordButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      minWidth: 96,
      alignItems: 'center',
    },
    passwordButtonText: {
      fontSize: 13,
      fontWeight: '600',
    },
    actionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'space-between',
    },
    actionCard: {
      width: '48%',
      padding: 14,
      borderRadius: 12,
      minHeight: 130,
      marginBottom: 12,
      // Better touch targets for mobile
      minWidth: 160,
      backgroundColor: glass,
      borderWidth: 1,
      borderColor: glassBorder,
      borderTopColor: glassHighlight,
      borderTopWidth: 1,
      overflow: 'hidden',
      ...glassShadow,
    },
    actionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    actionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    actionBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    actionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
    },
    actionDescription: {
      fontSize: 14,
      lineHeight: 20,
      flex: 1,
    },
    actionFooter: {
      alignItems: 'flex-end',
      marginTop: 12,
    },
    statusCard: {
      padding: 16,
      borderRadius: 12,
      backgroundColor: glass,
      borderWidth: 1,
      borderColor: glassBorder,
      borderTopColor: glassHighlight,
      borderTopWidth: 1,
      overflow: 'hidden',
      ...glassShadow,
    },
    statusItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 4,
      minHeight: 52,
    },
    statusInfo: {
      marginLeft: 12,
      flex: 1,
    },
    statusLabel: {
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 2,
    },
    statusValue: {
      fontSize: 12,
      fontWeight: '600',
    },
    loadingOverlay: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    alertsContainer: {
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: glass,
      borderWidth: 1,
      borderColor: glassBorder,
      borderTopColor: glassHighlight,
      borderTopWidth: 1,
      ...glassShadow,
    },
    alertItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 16,
      borderBottomWidth: 1,
      minHeight: 60,
    },
    alertIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 12,
    },
    alertContent: {
      flex: 1,
    },
    alertText: {
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 4,
      lineHeight: 20,
    },
    alertTime: {
      fontSize: 12,
    },
    emptyAlertsText: {
      textAlign: 'center',
      fontStyle: 'italic',
      padding: 24,
    },
    featureFlagsContainer: {
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: glass,
      borderWidth: 1,
      borderColor: glassBorder,
      borderTopColor: glassHighlight,
      borderTopWidth: 1,
      ...glassShadow,
    },
    featureFlag: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      minHeight: 56,
    },
    featureName: {
      fontSize: 14,
      fontWeight: '600',
    },
    featureStatusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      minWidth: 50,
      alignItems: 'center',
    },
    featureStatusText: {
      fontSize: 12,
      fontWeight: '700',
    },
  });
}
