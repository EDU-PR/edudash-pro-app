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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // Usage Banner
  usageBanner: {
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  usageBannerText: {
    fontSize: 12,
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
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
    marginHorizontal: 16,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '500',
  },

  // Model Selector
  modelSelector: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
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
