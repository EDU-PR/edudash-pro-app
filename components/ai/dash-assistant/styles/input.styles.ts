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
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 0,
    borderWidth: 0,
    borderRadius: 0,
    overflow: 'visible',
    ...Platform.select({
      ios: {
        shadowColor: '#020617',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
      },
      android: {
        elevation: 0,
      },
    }),
  },

  // Staff Actions Row
  staffActionsShell: {
    marginHorizontal: 14,
    marginTop: 2,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  staffActionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  staffActionsTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  staffActionsTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
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
    fontWeight: '600',
  },
  staffActionsCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  staffActionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  staffActionScroll: {
    gap: 8,
    paddingRight: 2,
  },
  staffActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
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
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  voiceStatusContent: {
    flex: 1,
    gap: 4,
  },
  voiceStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  voiceTranscript: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  voiceHint: {
    fontSize: 11,
    lineHeight: 15,
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
    borderRadius: 20,
    borderWidth: 1,
    position: 'relative',
    minHeight: 46,
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
    paddingVertical: 9,
    maxHeight: 104,
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
  attachmentImageCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
    width: 160,
    height: 160,
    overflow: 'hidden',
  },
  attachmentImageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  attachmentImagePreview: {
    width: '100%',
    height: '100%',
  },
  attachmentImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentImageBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentImageRemove: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  attachmentImageSize: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  attachmentImageSizeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
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
