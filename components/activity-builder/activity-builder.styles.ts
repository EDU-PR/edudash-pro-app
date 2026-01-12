import { StyleSheet } from 'react-native';

export const activityBuilderStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  stepWrapper: {
    alignItems: 'center',
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepNum: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepLabel: {
    fontSize: 12,
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    padding: 16,
    paddingBottom: 40,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  typeGrid: {
    gap: 12,
  },
  typeCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 12,
  },
  typeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  typeName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  typeDesc: {
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  difficultyChip: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rangeInput: {
    width: 60,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    textAlign: 'center',
    fontSize: 16,
  },
  rangeTo: {
    fontSize: 14,
  },
  rangeLabel: {
    fontSize: 14,
    marginLeft: 8,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  contentSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  pairInput: {
    width: 50,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pairEmoji: {
    fontSize: 28,
  },
  pairTextInput: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    fontSize: 14,
  },
  removeButton: {
    padding: 4,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  countEmojiBtn: {
    width: 50,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countEmoji: {
    fontSize: 28,
  },
  countX: {
    fontSize: 16,
  },
  countInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    minWidth: 30,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 8,
    marginBottom: 20,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  comingSoon: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  emojiPickerModal: {
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  emojiPickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  emojiOption: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiOptionText: {
    fontSize: 28,
  },
  cancelButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
