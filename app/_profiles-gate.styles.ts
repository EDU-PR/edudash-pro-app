/**
 * Styles for the ProfilesGate screen.
 *
 * @module profiles-gate.styles
 */

import { StyleSheet } from 'react-native';
import { type ThemeColors } from '@/contexts/ThemeContext';

function withAlpha(color: string | undefined, alpha: number, fallback: string): string {
  const base = color && color.startsWith('#') ? color.slice(1) : '';
  if (base.length !== 6) return fallback;
  const r = parseInt(base.slice(0, 2), 16);
  const g = parseInt(base.slice(2, 4), 16);
  const b = parseInt(base.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return fallback;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function createProfilesGateStyles(theme: ThemeColors) {
  const primary = theme?.primary || '#0b6bff';
  const primarySoft = withAlpha(primary, 0.12, '#e8f1ff');
  const primaryBorder = withAlpha(primary, 0.24, '#d7e6ff');
  const border = theme?.borderLight || theme?.border || '#e5e7eb';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme?.background || '#ffffff',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 24,
    },
    pendingCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: primarySoft,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: primaryBorder,
    },
    pendingTitle: {
      marginTop: 12,
      fontSize: 20,
      fontWeight: '700',
      color: theme?.text || '#0b1b34',
      textAlign: 'center',
    },
    pendingDescription: {
      marginTop: 8,
      fontSize: 15,
      color: theme?.textSecondary || '#4b5563',
      textAlign: 'center',
      lineHeight: 22,
    },
    pendingSpinnerRow: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
    },
    pendingSpinnerText: {
      marginLeft: 8,
      fontSize: 14,
      fontWeight: '600',
      color: primary,
    },
    pendingHint: {
      marginTop: 12,
      fontSize: 13,
      color: theme?.textSecondary || '#6b7280',
      textAlign: 'center',
      lineHeight: 18,
    },
    pendingActionButton: {
      marginTop: 16,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: primary,
    },
    pendingActionText: {
      color: theme?.onPrimary || '#ffffff',
      fontWeight: '700',
      fontSize: 14,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 24,
      paddingTop: 40,
      alignItems: 'center',
    },
    brandBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: primarySoft,
      borderWidth: 1,
      borderColor: primaryBorder,
      marginBottom: 20,
    },
    brandBadgeText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme?.text || '#0b1b34',
      letterSpacing: 0.2,
    },
    iconContainer: {
      marginBottom: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme?.text || '#000',
      textAlign: 'center',
      marginBottom: 12,
    },
    description: {
      fontSize: 16,
      color: theme?.textSecondary || '#666',
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 32,
    },
    recoveringContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    recoveringText: {
      fontSize: 14,
      color: primary,
      fontWeight: '600',
      marginLeft: 8,
    },
    suggestion: {
      fontSize: 14,
      color: '#FF9500',
      textAlign: 'center',
      fontWeight: '500',
      marginBottom: 32,
    },
    rolesList: {
      width: '100%',
      marginBottom: 32,
    },
    roleCard: {
      backgroundColor: theme?.surface || '#f8f9fa',
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      borderWidth: 2,
      borderColor: 'transparent',
      flexDirection: 'row',
      alignItems: 'center',
    },
    selectedRoleCard: {
      backgroundColor: primarySoft,
      borderColor: primary,
    },
    roleCardContent: {
      flex: 1,
    },
    roleTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme?.text || '#000',
      marginTop: 8,
      marginBottom: 4,
    },
    selectedRoleTitle: {
      color: primary,
    },
    roleDescription: {
      fontSize: 14,
      color: theme?.textSecondary || '#666',
      lineHeight: 20,
    },
    selectedRoleDescription: {
      color: theme?.textSecondary || '#0066CC',
    },
    radioContainer: {
      marginLeft: 16,
    },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    selectedRadio: {
      borderColor: primary,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: primary,
    },
    continueButton: {
      backgroundColor: primary,
      borderRadius: 12,
      height: 56,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    disabledButton: {
      backgroundColor: border,
    },
    continueButtonText: {
      color: theme?.onPrimary || '#ffffff',
      fontSize: 18,
      fontWeight: '600',
    },
    primaryButton: {
      backgroundColor: primary,
      borderRadius: 12,
      height: 56,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    primaryButtonText: {
      color: theme?.onPrimary || '#ffffff',
      fontSize: 18,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderRadius: 12,
      height: 56,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    secondaryButtonText: {
      color: primary,
      fontSize: 16,
      fontWeight: '500',
    },
  });
}
