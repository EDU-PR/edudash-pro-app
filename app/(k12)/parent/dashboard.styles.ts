/**
 * K-12 Parent Dashboard Styles
 * 
 * Extracted from dashboard.tsx to comply with WARP file size limits.
 */

import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  fixedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  schoolName: {
    fontSize: 14,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  profileGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  schoolTypeBadge: {
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  schoolTypeBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  schoolTypeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  childCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  childCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  childAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  childAvatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  childInfo: {
    flex: 1,
    marginLeft: 14,
  },
  childName: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
  },
  childGrade: {
    fontSize: 14,
  },
  childStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  childStat: {
    flex: 1,
    alignItems: 'center',
  },
  childStatValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  childStatLabel: {
    fontSize: 12,
  },
  childStatDivider: {
    width: 1,
    height: 30,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between', // Distribute cards evenly
  },
  quickActionCard: {
    // 3-column layout with consistent spacing
    // Container padding: 16*2 = 32px, gap between cards: 8px * 2 = 16px
    // Card width: (screenWidth - 32 - 16) / 3 = (screenWidth - 48) / 3
    // Using 33% minus margin for better cross-device compatibility
    width: '31%', // Slightly less than 33.33% to account for spacing
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12, // Vertical gap between rows
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  updateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  updateIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  updateInfo: {
    flex: 1,
  },
  updateChild: {
    fontSize: 12,
    marginBottom: 2,
  },
  updateMessage: {
    fontSize: 14,
    fontWeight: '500',
  },
  updateTime: {
    fontSize: 12,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  eventDate: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  eventDateText: {
    fontSize: 18,
    fontWeight: '700',
  },
  eventMonthText: {
    fontSize: 11,
    fontWeight: '600',
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 13,
  },
  communicationCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  communicationGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  communicationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  communicationIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  communicationText: {
    flex: 1,
  },
  communicationTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  communicationSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
  },
  dashAICard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  dashAIGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  dashAIContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dashAIIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  dashAIText: {
    flex: 1,
  },
  dashAITitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  dashAISubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    borderRadius: 12,
    gap: 8,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
