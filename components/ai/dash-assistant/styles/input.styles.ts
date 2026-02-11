/**
 * Input Styles
 * 
 * Styles for input components:
 * - DashInputBar
 * - Voice controls
 * - Attachment management
 */

import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export const inputStyles = StyleSheet.create({
  // Main Input Container
  inputContainer: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },

  // Staff Actions Row
  staffActionsShell: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  staffActionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  staffActionsTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  staffActionsTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  staffActionsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  staffActionsToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  staffActionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 8,
  },
  staffActionScroll: {
    gap: 8,
    paddingRight: 10,
  },
  staffActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  staffActionText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Voice Status Row
  voiceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  voiceStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  voiceTranscript: {
    fontSize: 12,
    flex: 1,
  },

  // Tutor Chip Row
  tutorChipRow: {
    paddingBottom: 10,
    gap: 8,
  },
  tutorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  tutorChipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Input Row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: screenWidth < 360 ? 6 : 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    position: 'relative',
    minHeight: 44,
  },
  inputAccessoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 10,
  },
  inputIconButton: {
    width: screenWidth < 360 ? 30 : 34,
    height: screenWidth < 360 ? 30 : 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxHeight: 88,
    fontSize: 15,
    lineHeight: 20,
    borderWidth: 0,
  },
  sendButton: {
    width: screenWidth < 360 ? 36 : 40,
    height: screenWidth < 360 ? 36 : 40,
    borderRadius: screenWidth < 360 ? 18 : 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Voice Orb
  orbButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    ...Platform.select({
      ios: {
        shadowColor: '#0ea5e9',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  orbPulseRing: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
  },
  recordButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Attachment Badges
  attachBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  attachBadgeSmall: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachBadgeSmallText: {
    fontSize: 8,
    fontWeight: '600',
  },

  // Attachment Chips
  attachmentChipsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 120,
  },
  attachmentChip: {
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
    minWidth: 200,
    maxWidth: 250,
    overflow: 'hidden',
  },
  attachmentChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  attachmentChipText: {
    flex: 1,
    marginLeft: 8,
    marginRight: 8,
  },
  attachmentChipName: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  attachmentChipSize: {
    fontSize: 11,
  },
  attachmentChipRemove: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentProgressContainer: {
    marginRight: 8,
  },
  attachmentProgressBar: {
    height: 2,
    marginHorizontal: 8,
    marginBottom: 4,
    borderRadius: 1,
  },
  attachmentProgressFill: {
    height: '100%',
    borderRadius: 1,
  },
});
