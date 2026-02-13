/**
 * Header Styles
 * 
 * Styles for Dash AI header components:
 * - DashHeader
 * - DashUsageBanner
 * - DashContextChips
 * - DashModelSelector
 */

import { StyleSheet, Platform } from 'react-native';

export const headerStyles = StyleSheet.create({
  // Header
  header: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    paddingTop: Platform.OS === 'ios' ? 8 : 8,
    borderBottomWidth: 0,
  },
  headerShell: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 6,
  },
  dashAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  headerAccentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  headerMetaPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerMetaText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
    lineHeight: 17,
  },
  tierBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  headerRight: {
    marginTop: 0,
  },
  actionRail: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
    borderWidth: 1,
  },
  iconButtonDanger: {
    borderColor: 'transparent',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
    borderWidth: 1,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  headerStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minHeight: 28,
  },
  headerStatusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerStatusSubtle: {
    fontSize: 10,
    fontWeight: '600',
  },
  tutorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  tutorMetaText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tutorTrack: {
    height: 4,
    borderRadius: 999,
    marginTop: 5,
    overflow: 'hidden',
  },
  tutorTrackFill: {
    height: '100%',
    borderRadius: 999,
  },

  // Usage Banner
  usageBanner: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  usageBannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  usageProgress: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  usageProgressFill: {
    height: '100%',
    borderRadius: 999,
  },

  // Context Chips
  contextStrip: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  contextChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  contextChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  contextHint: {
    marginHorizontal: 0,
    marginBottom: 0,
    marginTop: 1,
    fontSize: 12,
    fontWeight: '600',
  },

  // Model Selector
  modelSelector: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  modelSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modelSelectorTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modelSelectorHint: {
    fontSize: 11,
  },
  modelSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modelChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modelChipTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  modelChipSub: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
});
