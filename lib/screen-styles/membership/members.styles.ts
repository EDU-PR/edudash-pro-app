import { StyleSheet } from 'react-native';

export type FilterType = 'all' | 'active' | 'pending' | 'expired';
export type SortType = 'name' | 'date' | 'region';

export function createStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    // Custom Header
    customHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    headerLeft: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
    },
    headerSubtitle: {
      fontSize: 13,
      marginTop: 2,
    },
    headerButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    headerButton: {
      padding: 4,
    },

    // Search
    searchContainer: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      height: 46,
      borderRadius: 12,
      borderWidth: 1,
      gap: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
    },

    // Filters
    filtersContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 10,
    },
    scrollableFilters: {
      flex: 1,
      flexDirection: 'row',
      gap: 8,
    },
    filterButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
    },
    filterButtonText: {
      fontSize: 13,
      fontWeight: '600',
    },
    sortButton: {
      width: 40,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Results
    resultsHeader: {
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    resultsCount: {
      fontSize: 13,
    },

    // List
    listContent: {
      paddingHorizontal: 16,
    },

    // Member Card
    memberCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      borderRadius: 14,
      marginBottom: 10,
    },
    memberLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },
    avatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
    },
    avatarPlaceholder: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 18,
      fontWeight: '700',
    },
    memberInfo: {
      flex: 1,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    memberName: {
      fontSize: 15,
      fontWeight: '600',
    },
    vipBadge: {
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberNumber: {
      fontSize: 12,
      marginTop: 2,
    },
    memberMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
    },
    typeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    typeText: {
      fontSize: 10,
      fontWeight: '600',
    },
    regionText: {
      fontSize: 11,
    },
    memberRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },

    // Empty State
    emptyState: {
      alignItems: 'center',
      paddingTop: 60,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginTop: 16,
    },
    emptySubtitle: {
      fontSize: 14,
      marginTop: 4,
      textAlign: 'center',
      paddingHorizontal: 32,
    },

    // Loading State
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 60,
    },
    loadingText: {
      fontSize: 14,
      marginTop: 12,
    },

    // Error State
    errorContainer: {
      alignItems: 'center',
      paddingVertical: 24,
      paddingHorizontal: 16,
    },
    errorText: {
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 12,
    },
    retryButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    retryButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },

    // FAB
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },
  });
}
