import { StyleSheet } from 'react-native';
import type { ThemeColors } from '@/contexts/ThemeContext';

export const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme?.background || '#0a0a0f',
  },
  // Enhanced Header Styles
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    padding: 6,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  settingsButton: {
    padding: 6,
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  // Content
  contentContainer: {
    flex: 1,
  },
  // Tabs
  tabsContainer: {
    marginTop: 16,
    maxHeight: 56,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: theme?.card || '#1a1a2e',
    marginRight: 8,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#6366F1',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme?.textSecondary || '#9ca3af',
  },
  activeTabText: {
    color: 'white',
  },
  // Search and Filter
  searchFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme?.card || '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme?.text || '#fff',
  },
  filterButton: {
    padding: 12,
    backgroundColor: theme?.card || '#1a1a2e',
    borderRadius: 12,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
  },
  // Warning Banner
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#dc2626',
  },
  warningLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dc2626',
  },
  // Overview
  overviewContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme?.text || '#fff',
    marginTop: 8,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme?.textSecondary || '#9ca3af',
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  emptyButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalKeyboardAvoider: {
    flex: 1,
    justifyContent: 'center',
  },
  modalScrollContent: {
    paddingVertical: 20,
  },
  actionSheet: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 10,
  },
  actionSheetTitle: {
    fontWeight: '700',
    fontSize: 18,
  },
  actionSheetSubtitle: {
    fontSize: 14,
    marginBottom: 6,
  },
  actionSheetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: theme?.surface || '#111827',
    borderWidth: 1,
    borderColor: theme?.border || '#1f2937',
    gap: 12,
  },
  actionSheetCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheetCardInfo: {
    flex: 1,
  },
  actionSheetCardTitle: {
    fontWeight: '700',
    fontSize: 15,
  },
  actionSheetCardDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  actionSheetCancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  actionSheetCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontWeight: '700',
    fontSize: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    fontSize: 16,
  },
  inviteShareCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 12,
  },
  inviteMetaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inviteMetaPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#111827',
  },
  inviteMetaLabel: {
    fontSize: 10,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inviteMetaValue: {
    fontSize: 13,
    color: '#f8fafc',
    fontWeight: '600',
    marginTop: 4,
  },
  inviteActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inviteActionButton: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
  },
  inviteActionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  invitePrimary: {
    backgroundColor: '#22c55e',
  },
  inviteSecondary: {
    backgroundColor: '#6366f1',
  },
  inviteNeutral: {
    backgroundColor: '#e2e8f0',
  },
  inviteNeutralText: {
    color: '#111827',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    flex: 1,
    gap: 8,
  },
  btnPrimary: {
    backgroundColor: '#6366F1',
  },
  btnPrimaryText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
  btnSecondary: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  btnSecondaryText: {
    fontWeight: '600',
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnDanger: {
    backgroundColor: '#fee2e2',
  },
  btnDangerText: {
    color: '#dc2626',
    fontWeight: '800',
  },
  // Legacy styles for compatibility
  seatUsageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme?.surface || 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#f3f4f6',
    marginBottom: 8,
  },
  seatUsageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  seatUsageText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme?.text || '#333',
    marginLeft: 8,
  },
  overLimitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  overLimitText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
    marginLeft: 4,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: theme?.surfaceVariant || '#f9fafb',
  },
});
