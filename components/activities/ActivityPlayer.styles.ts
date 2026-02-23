/**
 * ActivityPlayer Styles
 * Extracted for WARP.md compliance (StyleSheet >200 lines → separate file)
 */

import { StyleSheet } from 'react-native';

export const createActivityPlayerStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      paddingTop: 12,
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    activityEmoji: {
      fontSize: 36,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#fff',
    },
    roundLabel: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.8)',
      fontWeight: '600',
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressTrack: {
      height: 6,
      backgroundColor: 'rgba(255,255,255,0.3)',
      borderRadius: 3,
      marginTop: 12,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#fff',
      borderRadius: 3,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
      gap: 20,
    },
    prompt: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
      lineHeight: 32,
    },
    movementCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      gap: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    movementRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    movementEmoji: {
      fontSize: 36,
    },
    movementInfo: {
      flex: 1,
    },
    movementText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    movementTime: {
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    confirmBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: '#10B981',
      borderRadius: 16,
      paddingVertical: 18,
      paddingHorizontal: 24,
    },
    confirmText: {
      fontSize: 20,
      fontWeight: '800',
      color: '#fff',
    },
    hintCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: '#FEF9C3',
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: '#FDE68A',
    },
    hintText: {
      flex: 1,
      fontSize: 15,
      color: '#92400E',
      fontWeight: '600',
      lineHeight: 22,
    },
    celebrationOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 30,
      backgroundColor: 'rgba(15,23,42,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    celebrationCard: {
      width: '100%',
      maxWidth: 420,
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: 24,
      gap: 12,
      borderWidth: 2,
      borderColor: '#FDE68A',
      shadowColor: '#F59E0B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 6,
    },
    celebrationEmoji: {
      fontSize: 48,
    },
    celebrationText: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
      lineHeight: 26,
    },
    nextBtn: {
      backgroundColor: '#6D28D9',
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 32,
      marginTop: 4,
      minWidth: 190,
      alignItems: 'center',
    },
    nextBtnText: {
      color: '#fff',
      fontSize: 17,
      fontWeight: '700',
    },
    // Dash speaking bubble — shows between rounds and during auto-reveal
    dashBubble: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 16,
      marginTop: 10,
      backgroundColor: '#EDE9FE',
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: '#C4B5FD',
    },
    dashBubbleEmoji: {
      fontSize: 28,
    },
    dashBubbleContent: {
      flex: 1,
    },
    dashBubbleText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#5B21B6',
      lineHeight: 22,
    },
  });
