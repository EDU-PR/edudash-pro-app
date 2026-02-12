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
    paddingBottom: 12,
    paddingTop: Platform.OS === 'ios' ? 56 : 12,
    borderBottomWidth: 0,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 10,
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
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
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
    fontSize: 13,
    marginTop: 3,
    fontWeight: '500',
    lineHeight: 18,
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
    marginTop: 10,
  },
  actionRail: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  usageBannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  usageProgress: {
    width: 90,
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
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
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
