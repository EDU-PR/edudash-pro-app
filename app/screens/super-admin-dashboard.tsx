import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Switch, Modal, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ThemedStatusBar from '@/components/ui/ThemedStatusBar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { signOutAndRedirect } from '@/lib/authActions';
import { useTheme } from '@/contexts/ThemeContext';
import { isSuperAdmin } from '@/lib/roleUtils';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { createStyles } from '@/lib/screen-styles/super-admin-dashboard.styles';
import { useSuperAdminDashboard } from '@/hooks/super-admin-dashboard';
export default function SuperAdminDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showAlert, alertProps } = useAlertModal();
  const {
    user, profile, authLoading, profileLoading,
    loading, refreshing, dashboardStats, systemStatus, recentAlerts, featureFlags, quickActions,
    aiControl, aiControlLoading,
    isOwner, isOwnerUnclaimed, canEditAIControl, highRiskAvailable, ownerStatusText,
    claimOwnership, updateAIControl, applyAutonomyPreset,
    passwordModal, setPasswordValue, closePasswordModal, handlePasswordConfirm,
    onRefresh, handleQuickAction,
    getAlertColor, formatAlertTime,
  } = useSuperAdminDashboard(showAlert);
  if (authLoading || profileLoading) {
    return (
      <View style={styles.container}>
        <ThemedStatusBar />
        <SafeAreaView style={styles.loadingContainer}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading admin profile…</Text>
        </SafeAreaView>
      </View>
    );
  }
  if (!profile || !isSuperAdmin(profile.role)) {
    return (
      <View style={styles.container}>
        <ThemedStatusBar />
        <SafeAreaView style={styles.accessDeniedContainer}>
          <Ionicons name="shield-checkmark" size={64} color={theme.error} />
          <Text style={[styles.accessDeniedText, { color: theme.text }]}>Access Denied</Text>
          <Text style={[styles.accessDeniedSubtext, { color: theme.textSecondary }]}>Super Admin privileges required</Text>
          <Text style={[styles.debugText, { color: theme.textTertiary }]}>Current role: {profile?.role || 'undefined'}</Text>
          <TouchableOpacity
            style={[styles.signOutButton, { backgroundColor: theme.error }]}
            onPress={() => signOutAndRedirect({ redirectTo: '/(auth)/sign-in' })}
          >
            <Text style={[styles.signOutButtonText, { color: theme.onError }]}>Sign Out</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }
  return (
    <DesktopLayout role="super_admin" title="Super Admin">
      <View style={styles.container}>
        <ThemedStatusBar />
        {/* NEXT-GEN glass backdrop */}
        <LinearGradient
          pointerEvents="none"
          colors={['#0B1020', '#10162B', '#0B1020']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bgLayer}
        />
        <View pointerEvents="none" style={styles.bgBlobA} />
        <View pointerEvents="none" style={styles.bgBlobB} />
        <View pointerEvents="none" style={styles.bgBlobC} />
        {/* Quick Access Bar */}
        <View style={styles.quickAccessBar}>
          <View style={styles.quickAccessLeft}>
            <TouchableOpacity
              style={[styles.aiButton, { backgroundColor: '#8b5cf6' }]}
              onPress={() => router.push('/screens/dash-voice?mode=ops' as any)}
              accessibilityRole="button"
              accessibilityLabel="Open Dash Voice Orb"
              accessibilityHint="Opens the full-screen voice orb for operations commands."
            >
              <Ionicons name="mic" size={16} color="#fff" />
              <Text style={styles.aiButtonText}>Voice ORB</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.opsConsoleButton}
              onPress={() => router.push('/screens/super-admin-ai-command-center' as any)}
              accessibilityRole="button"
              accessibilityLabel="Open Ops Console"
              accessibilityHint="Opens the Ops command console for text-based requests."
            >
              <Ionicons name="terminal-outline" size={16} color="#fff" />
              <Text style={styles.opsConsoleText}>Ops Console</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.healthIndicator, {
            backgroundColor: dashboardStats?.system_health === 'healthy' ? '#10b98108' : '#f59e0b08',
            borderColor: dashboardStats?.system_health === 'healthy' ? '#10b981' : '#f59e0b',
          }]}>
            <Ionicons
              name={dashboardStats?.system_health === 'healthy' ? 'checkmark-circle' : 'warning'}
              size={14}
              color={dashboardStats?.system_health === 'healthy' ? '#10b981' : '#f59e0b'}
            />
            <Text style={[styles.healthText, {
              color: dashboardStats?.system_health === 'healthy' ? '#10b981' : '#f59e0b',
            }]}>
              {dashboardStats?.system_health === 'healthy' ? 'All Systems Operational' : 'System Issues'}
            </Text>
          </View>
        </View>
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 24 }}
          scrollIndicatorInsets={{ bottom: Math.max(insets.bottom, 12) + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        >
          {/* Dash AI Owner Controls */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Dash AI Owner Controls</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              One-owner autonomy controls for when you're away
            </Text>
            <View style={styles.aiControlCard}>
              <View style={styles.aiControlHeader}>
                <View style={styles.aiControlOwnerInfo}>
                  <Text style={[styles.aiControlTitle, { color: theme.text }]}>Platform Owner</Text>
                  <Text style={[styles.aiControlSubtext, { color: theme.textSecondary }]}>{ownerStatusText}</Text>
                </View>
                {aiControlLoading ? (
                  <EduDashSpinner size="small" color={theme.primary} />
                ) : !aiControl ? (
                  <View style={[styles.aiOwnerBadge, { backgroundColor: 'rgba(239, 68, 68, 0.22)', borderColor: '#f87171' }]}>
                    <Ionicons name="cloud-offline-outline" size={12} color="#fecaca" />
                    <Text style={[styles.aiOwnerBadgeText, { color: '#fecaca' }]}>UNAVAILABLE</Text>
                  </View>
                ) : isOwnerUnclaimed ? (
                  <TouchableOpacity
                    style={[styles.aiOwnerButton, { backgroundColor: theme.primary }]}
                    onPress={claimOwnership}
                  >
                    <Text style={[styles.aiOwnerButtonText, { color: theme.onPrimary }]}>Claim</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.aiOwnerBadge, {
                    backgroundColor: isOwner ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    borderColor: isOwner ? '#34d399' : '#fbbf24',
                  }]}>
                    <Ionicons
                      name={isOwner ? 'checkmark-circle' : 'lock-closed'}
                      size={12}
                      color={isOwner ? '#6ee7b7' : '#fcd34d'}
                    />
                    <Text style={[styles.aiOwnerBadgeText, { color: isOwner ? '#6ee7b7' : '#fcd34d' }]}>
                      {isOwner ? 'ONLINE' : 'READ ONLY'}
                    </Text>
                  </View>
                )}
              </View>
              {!aiControl && !aiControlLoading && (
                <Text style={[styles.aiControlSubtext, { color: theme.textSecondary }]}>
                  Unable to load autonomy settings. Pull to refresh.
                </Text>
              )}
              {aiControl && (
                <>
                  <View style={[styles.aiControlDivider, { backgroundColor: theme.divider }]} />
                  <View style={styles.aiControlRow}>
                    <View style={styles.aiControlInfo}>
                      <Text style={[styles.aiControlLabel, { color: theme.text }]}>Autonomy Enabled</Text>
                      <Text style={[styles.aiControlHint, { color: theme.textSecondary }]}>
                        Allow Dash AI to run tasks when you're unavailable
                      </Text>
                    </View>
                    <Switch
                      value={!!aiControl.autonomy_enabled}
                      onValueChange={(value) => updateAIControl({ autonomy_enabled: value })}
                      disabled={!canEditAIControl}
                    />
                  </View>
                  <View style={styles.aiControlRow}>
                    <View style={styles.aiControlInfo}>
                      <Text style={[styles.aiControlLabel, { color: theme.text }]}>Autonomy Mode</Text>
                      <Text style={[styles.aiControlHint, { color: theme.textSecondary }]}>
                        Choose how proactive Dash should be
                      </Text>
                    </View>
                  </View>
                  <View style={styles.aiModeRow}>
                    {(['assistant', 'copilot', 'full'] as const).map((mode) => {
                      const isActive = aiControl.autonomy_mode === mode;
                      return (
                        <TouchableOpacity
                          key={mode}
                          style={[styles.aiModeButton, {
                            backgroundColor: isActive ? theme.primary : theme.surfaceVariant,
                            borderColor: isActive ? theme.primary : theme.border,
                            opacity: canEditAIControl ? 1 : 0.6,
                          }]}
                          onPress={() => updateAIControl({
                            autonomy_mode: mode,
                            ...(mode !== 'full' ? { auto_execute_high: false } : {}),
                          })}
                          disabled={!canEditAIControl}
                        >
                          <Text style={[styles.aiModeButtonText, { color: isActive ? theme.onPrimary : theme.text }]}>
                            {mode === 'assistant' ? 'Assistant' : mode === 'copilot' ? 'Copilot' : 'Full'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={[styles.aiControlDivider, { backgroundColor: theme.divider }]} />
                  <View style={styles.aiControlRow}>
                    <View style={styles.aiControlInfo}>
                      <Text style={[styles.aiControlLabel, { color: theme.text }]}>Auto-execute Low Risk</Text>
                      <Text style={[styles.aiControlHint, { color: theme.textSecondary }]}>
                        Routine actions (safe to run automatically)
                      </Text>
                    </View>
                    <Switch
                      value={!!aiControl.auto_execute_low}
                      onValueChange={(value) => updateAIControl({ auto_execute_low: value })}
                      disabled={!canEditAIControl}
                    />
                  </View>
                  <View style={styles.aiControlRow}>
                    <View style={styles.aiControlInfo}>
                      <Text style={[styles.aiControlLabel, { color: theme.text }]}>Auto-execute Medium Risk</Text>
                      <Text style={[styles.aiControlHint, { color: theme.textSecondary }]}>
                        Requires more caution; enable for copilot/full
                      </Text>
                    </View>
                    <Switch
                      value={!!aiControl.auto_execute_medium}
                      onValueChange={(value) => updateAIControl({ auto_execute_medium: value })}
                      disabled={!canEditAIControl || aiControl.autonomy_mode === 'assistant'}
                    />
                  </View>
                  <View style={styles.aiControlRow}>
                    <View style={styles.aiControlInfo}>
                      <Text style={[styles.aiControlLabel, { color: theme.text }]}>Auto-execute High Risk</Text>
                      <Text style={[styles.aiControlHint, { color: theme.textSecondary }]}>
                        Only available in Full mode
                      </Text>
                    </View>
                    <Switch
                      value={!!aiControl.auto_execute_high && highRiskAvailable}
                      onValueChange={(value) => updateAIControl({ auto_execute_high: value })}
                      disabled={!canEditAIControl || !highRiskAvailable}
                    />
                  </View>
                  <View style={styles.aiControlRow}>
                    <View style={styles.aiControlInfo}>
                      <Text style={[styles.aiControlLabel, { color: theme.text }]}>Confirm Navigation</Text>
                      <Text style={[styles.aiControlHint, { color: theme.textSecondary }]}>
                        Require approval before app navigation
                      </Text>
                    </View>
                    <Switch
                      value={!!aiControl.require_confirm_navigation}
                      onValueChange={(value) => updateAIControl({ require_confirm_navigation: value })}
                      disabled={!canEditAIControl}
                    />
                  </View>
                  {!aiControl.autonomy_enabled && (
                    <Text style={[styles.aiControlNote, { color: theme.textSecondary }]}>
                      Autonomy is disabled. Dash will request approval for actions.
                    </Text>
                  )}
                  <View style={styles.aiPresetRow}>
                    {(['lockdown', 'assistant', 'copilot', 'full'] as const).map((preset) => (
                      <TouchableOpacity
                        key={preset}
                        style={[styles.aiPresetButton, {
                          borderColor: theme.border,
                          backgroundColor: theme.surfaceVariant,
                          opacity: canEditAIControl ? 1 : 0.6,
                        }]}
                        onPress={() => applyAutonomyPreset(preset)}
                        disabled={!canEditAIControl}
                      >
                        <Text style={[styles.aiPresetButtonText, { color: theme.text }]}>
                          {preset.charAt(0).toUpperCase() + preset.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </View>
          </View>
          {/* Global Platform Overview */}
          {dashboardStats && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Global Platform Overview</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Empowering educational institutions across South Africa
              </Text>
              <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                  <Ionicons name="business" size={24} color="#3b82f6" />
                  <Text style={[styles.statValue, { color: theme.text }]}>{dashboardStats.total_organizations}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Active Organizations</Text>
                  <Text style={[styles.statSubtext, { color: theme.textTertiary }]}>All institution types</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="card" size={24} color="#10b981" />
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    R{Math.round(dashboardStats.monthly_revenue).toLocaleString()}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Monthly Revenue</Text>
                  <Text style={[styles.statSubtext, { color: theme.textTertiary }]}>Subscriptions</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="alert-circle" size={24} color="#f59e0b" />
                  <Text style={[styles.statValue, { color: theme.text }]}>{dashboardStats.pending_issues}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Critical Issues</Text>
                  <Text style={[styles.statSubtext, { color: theme.textTertiary }]}>Needs attention</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="flash" size={24} color="#8b5cf6" />
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    ${Math.round(dashboardStats.ai_usage_cost).toLocaleString()}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>AI Usage Cost</Text>
                  <Text style={[styles.statSubtext, { color: theme.textTertiary }]}>Last 30 days</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="people" size={24} color="#06b6d4" />
                  <Text style={[styles.statValue, { color: theme.text }]}>{dashboardStats.total_users}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Users</Text>
                  <Text style={[styles.statSubtext, { color: theme.textTertiary }]}>{dashboardStats.active_users} active</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="person-add" size={24} color="#ec4899" />
                  <Text style={[styles.statValue, { color: theme.text }]}>{dashboardStats.active_seats}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Active Seats</Text>
                  <Text style={[styles.statSubtext, { color: theme.textTertiary }]}>Licensed</Text>
                </View>
              </View>
            </View>
          )}
          {/* Recent Alerts */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Alerts</Text>
            <View style={styles.alertsContainer}>
              {recentAlerts.length > 0 ? (
                recentAlerts.map((alert) => (
                  <View key={alert.id} style={[styles.alertItem, { borderBottomColor: theme.divider }]}>
                    <View style={[styles.alertIndicator, { backgroundColor: getAlertColor(alert.severity) }]} />
                    <View style={styles.alertContent}>
                      <Text style={[styles.alertText, { color: theme.text }]}>{alert.message}</Text>
                      <Text style={[styles.alertTime, { color: theme.textSecondary }]}>
                        {formatAlertTime(alert.timestamp)}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyAlertsText, { color: theme.textSecondary }]}>No recent alerts</Text>
              )}
            </View>
          </View>
          {/* Feature Flag Status */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Feature Flag Status</Text>
            <View style={styles.featureFlagsContainer}>
              {featureFlags.map((flag, index) => (
                <View
                  key={flag.name}
                  style={[styles.featureFlag, {
                    borderBottomColor: index === featureFlags.length - 1 ? 'transparent' : theme.divider,
                  }]}
                >
                  <Text style={[styles.featureName, { color: theme.text }]}>{flag.name}</Text>
                  <View style={[styles.featureStatusBadge, { backgroundColor: flag.color }]}>
                    <Text style={[styles.featureStatusText, { color: '#ffffff' }]}>{flag.percentage}%</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              {quickActions.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={styles.actionCard}
                  onPress={() => handleQuickAction(action)}
                >
                  <View style={styles.actionHeader}>
                    <View style={[styles.actionIcon, { backgroundColor: action.color + '20' }]}>
                      <Ionicons name={action.icon as any} size={24} color={action.color} />
                    </View>
                    {action.badge !== undefined && action.badge > 0 && (
                      <View style={[styles.actionBadge, { backgroundColor: theme.error }]}>
                        <Text style={[styles.actionBadgeText, { color: theme.onError }]}>{action.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.actionTitle, { color: theme.text }]}>{action.title}</Text>
                  <Text style={[styles.actionDescription, { color: theme.textSecondary }]}>{action.description}</Text>
                  <View style={styles.actionFooter}>
                    <Ionicons name="arrow-forward" size={16} color={action.color} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {/* System Status */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>System Status</Text>
            <View style={styles.statusCard}>
              {systemStatus ? (
                <>
                  <View style={styles.statusItem}>
                    <Ionicons name="server" size={20} color={systemStatus.database.color} />
                    <View style={styles.statusInfo}>
                      <Text style={[styles.statusLabel, { color: theme.text }]}>Database</Text>
                      <Text style={[styles.statusValue, { color: systemStatus.database.color }]}>
                        {systemStatus.database.status}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statusItem}>
                    <Ionicons name="cloud" size={20} color={systemStatus.api.color} />
                    <View style={styles.statusInfo}>
                      <Text style={[styles.statusLabel, { color: theme.text }]}>API Services</Text>
                      <Text style={[styles.statusValue, { color: systemStatus.api.color }]}>
                        {systemStatus.api.status}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statusItem}>
                    <Ionicons name="shield-checkmark" size={20} color={systemStatus.security.color} />
                    <View style={styles.statusInfo}>
                      <Text style={[styles.statusLabel, { color: theme.text }]}>Security</Text>
                      <Text style={[styles.statusValue, { color: systemStatus.security.color }]}>
                        {systemStatus.security.status}
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.statusItem}>
                  <EduDashSpinner size="small" color={theme.primary} />
                  <View style={styles.statusInfo}>
                    <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Loading system status...</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
          {loading && (
            <View style={styles.loadingOverlay}>
              <EduDashSpinner size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading dashboard data...</Text>
            </View>
          )}
        </ScrollView>
        <Modal
          visible={passwordModal.visible}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => closePasswordModal(false)}
        >
          <View style={styles.passwordOverlay}>
            <View style={[styles.passwordCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.passwordTitle, { color: theme.text }]}>Confirm Password</Text>
              <Text style={[styles.passwordMessage, { color: theme.textSecondary }]}>
                {passwordModal.message}
              </Text>
              <TextInput
                value={passwordModal.value}
                onChangeText={setPasswordValue}
                placeholder="Enter your password"
                placeholderTextColor={theme.textTertiary}
                secureTextEntry
                autoCapitalize="none"
                style={[styles.passwordInput, {
                  backgroundColor: theme.surfaceVariant,
                  borderColor: passwordModal.error ? theme.error : theme.border,
                  color: theme.text,
                }]}
              />
              {passwordModal.error && (
                <Text style={[styles.passwordError, { color: theme.error }]}>{passwordModal.error}</Text>
              )}
              <View style={styles.passwordActions}>
                <TouchableOpacity
                  style={[styles.passwordButton, { borderColor: theme.border }]}
                  onPress={() => closePasswordModal(false)}
                  disabled={passwordModal.submitting}
                >
                  <Text style={[styles.passwordButtonText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.passwordButton, { backgroundColor: theme.primary, borderColor: theme.primary }]}
                  onPress={handlePasswordConfirm}
                  disabled={passwordModal.submitting}
                >
                  {passwordModal.submitting ? (
                    <EduDashSpinner size="small" color={theme.onPrimary} />
                  ) : (
                    <Text style={[styles.passwordButtonText, { color: theme.onPrimary }]}>Confirm</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        <AlertModal {...alertProps} />
      </View>
    </DesktopLayout>
  );
}
