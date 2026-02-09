import { StyleSheet } from 'react-native';

export const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: 16,
      color: theme.textSecondary,
      fontSize: 16,
    },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 20,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    backButton: {
      padding: 8,
    },
    headerTitleContainer: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: '#fff',
    },
    headerSubtitle: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.7)',
      marginTop: 2,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 20,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: 16,
    },
    statItem: {
      alignItems: 'center',
    },
    statNumber: {
      fontSize: 24,
      fontWeight: '700',
      color: '#fff',
    },
    statLabel: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.7)',
      marginTop: 4,
    },
    statDivider: {
      width: 1,
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    listContent: {
      padding: 16,
      paddingBottom: 100,
    },
    teacherCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#06B6D420',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 20,
      fontWeight: '700',
      color: '#06B6D4',
    },
    cardInfo: {
      flex: 1,
    },
    teacherName: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.text,
    },
    teacherEmail: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 2,
    },
    teacherPhone: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 1,
    },
    cardMeta: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      gap: 6,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    metaText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    cardActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 10,
    },
    rejectButton: {
      backgroundColor: '#EF444410',
      borderWidth: 1,
      borderColor: '#EF444430',
    },
    approveButton: {
      backgroundColor: '#10B981',
    },
    actionButtonText: {
      fontSize: 15,
      fontWeight: '600',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: 40,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      marginTop: 16,
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    inviteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#06B6D4',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 10,
      marginTop: 24,
    },
    inviteButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600',
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
    },
    modalContent: {
      flex: 1,
      padding: 20,
    },
    modalSection: {
      marginBottom: 24,
    },
    modalSectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    modalText: {
      fontSize: 17,
      color: theme.text,
      fontWeight: '500',
    },
    modalTextSecondary: {
      fontSize: 15,
      color: theme.textSecondary,
      marginTop: 4,
    },
    reasonInput: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 15,
      color: theme.text,
      minHeight: 120,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 24,
    },
    cancelModalButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cancelModalButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    confirmRejectButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: '#EF4444',
    },
    confirmRejectButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
  });
