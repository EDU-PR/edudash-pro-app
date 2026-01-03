/**
 * Budget Request Form Component - Extracted for reuse and file size compliance
 */
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORIES } from '@/hooks/membership/useBudgetRequests';
import { styles } from './budget-requests.styles';

interface BudgetRequestFormProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  formData: { title: string; description: string; amount: string; category: string };
  setFormData: React.Dispatch<React.SetStateAction<{ title: string; description: string; amount: string; category: string }>>;
  theme: { card: string; background: string; text: string; textSecondary: string; border: string };
}

export function BudgetRequestForm({ visible, onClose, onSubmit, isSubmitting, formData, setFormData, theme }: BudgetRequestFormProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>New Budget Request</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
          </View>

          <ScrollView style={styles.modalForm}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Title *</Text>
            <TextInput style={[styles.textInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} placeholder="Enter request title" placeholderTextColor={theme.textSecondary} value={formData.title} onChangeText={(t) => setFormData(p => ({ ...p, title: t }))} />

            <Text style={[styles.inputLabel, { color: theme.text }]}>Amount (ZAR) *</Text>
            <TextInput style={[styles.textInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} placeholder="0.00" placeholderTextColor={theme.textSecondary} keyboardType="numeric" value={formData.amount} onChangeText={(t) => setFormData(p => ({ ...p, amount: t }))} />

            <Text style={[styles.inputLabel, { color: theme.text }]}>Category</Text>
            <View style={styles.categorySelector}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity key={cat} style={[styles.categoryOption, { backgroundColor: formData.category === cat ? '#10B981' : theme.background, borderColor: formData.category === cat ? '#10B981' : theme.border }]} onPress={() => setFormData(p => ({ ...p, category: cat }))}>
                  <Text style={[styles.categoryOptionText, { color: formData.category === cat ? '#fff' : theme.text }]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: theme.text }]}>Description</Text>
            <TextInput style={[styles.textInput, styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} placeholder="Describe the purpose" placeholderTextColor={theme.textSecondary} multiline numberOfLines={4} textAlignVertical="top" value={formData.description} onChangeText={(t) => setFormData(p => ({ ...p, description: t }))} />
          </ScrollView>

          <TouchableOpacity style={[styles.submitButton, { opacity: isSubmitting ? 0.7 : 1 }]} onPress={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <><Ionicons name="send" size={20} color="#fff" /><Text style={styles.submitButtonText}>Submit Request</Text></>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
