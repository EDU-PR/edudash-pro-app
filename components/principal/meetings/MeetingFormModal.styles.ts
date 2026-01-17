// Styles for Meeting Form Modal - Extracted for WARP.md compliance

import { StyleSheet } from 'react-native';

export const createStyles = (theme: any, insetBottom: number) => StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: theme.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalCancel: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  modalSave: {
    fontSize: 16,
    color: theme.primary,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
  },
  modalContentInner: {
    padding: 16,
    paddingBottom: insetBottom + 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: theme.text,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  typeOptionText: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 14,
  },
  datePickerText: {
    fontSize: 16,
    color: theme.text,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 16,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleLabel: {
    fontSize: 16,
    color: theme.text,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.border,
    padding: 2,
  },
  toggleActive: {
    backgroundColor: theme.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleThumbActive: {
    marginLeft: 22,
  },
  agendaInput: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  addAgendaButton: {
    backgroundColor: theme.primary,
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  agendaItemNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  agendaItemNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  agendaItemText: {
    flex: 1,
    fontSize: 14,
    color: theme.text,
  },
});
