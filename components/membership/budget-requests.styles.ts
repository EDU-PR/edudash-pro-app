/**
 * Styles for Budget Request Form Component
 */
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  // Modal styles - used by BudgetRequestForm component
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'flex-end' 
  },
  modalContent: { 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    paddingTop: 20, 
    paddingHorizontal: 20, 
    paddingBottom: 40, 
    maxHeight: '90%' 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20 
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: '700' 
  },
  modalForm: { 
    maxHeight: 400 
  },
  inputLabel: { 
    fontSize: 14, 
    fontWeight: '600', 
    marginBottom: 8, 
    marginTop: 16 
  },
  textInput: { 
    borderWidth: 1, 
    borderRadius: 12, 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    fontSize: 16 
  },
  textArea: { 
    height: 100, 
    paddingTop: 12 
  },
  categorySelector: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8 
  },
  categoryOption: { 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 8, 
    borderWidth: 1 
  },
  categoryOptionText: { 
    fontSize: 14, 
    fontWeight: '500' 
  },
  submitButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#10B981', 
    paddingVertical: 14, 
    borderRadius: 12, 
    marginTop: 20, 
    gap: 8 
  },
  submitButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600' 
  },
});
