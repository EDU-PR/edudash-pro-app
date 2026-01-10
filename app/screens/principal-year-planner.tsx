/**
 * Principal Year Planner Screen
 * 
 * Allows principals to create and manage academic terms for the year.
 * Native app version matching web functionality.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { useTranslation } from 'react-i18next';
import { extractOrganizationId } from '@/lib/tenant/compat';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AcademicTerm } from '@/types/ecd-planning';

export default function PrincipalYearPlannerScreen() {
  const { theme } = useTheme();
  const { profile, user } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets);
  
  const orgId = extractOrganizationId(profile);
  
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTerm, setEditingTerm] = useState<AcademicTerm | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    academic_year: new Date().getFullYear(),
    term_number: 1,
    start_date: new Date(),
    end_date: new Date(),
    description: '',
    is_active: false,
    is_published: false,
  });

  const fetchTerms = useCallback(async () => {
    if (!orgId) return;
    
    try {
      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from('academic_terms')
        .select('*')
        .eq('preschool_id', orgId)
        .order('academic_year', { ascending: false })
        .order('term_number', { ascending: true });
      
      if (error) throw error;
      setTerms(data || []);
    } catch (error: any) {
      console.error('Error fetching terms:', error);
      Alert.alert('Error', 'Failed to load terms');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTerms();
  };

  const openCreateModal = () => {
    setFormData({
      name: '',
      academic_year: new Date().getFullYear(),
      term_number: 1,
      start_date: new Date(),
      end_date: new Date(),
      description: '',
      is_active: false,
      is_published: false,
    });
    setEditingTerm(null);
    setShowCreateModal(true);
  };

  const openEditModal = (term: AcademicTerm) => {
    setFormData({
      name: term.name,
      academic_year: term.academic_year,
      term_number: term.term_number,
      start_date: new Date(term.start_date),
      end_date: new Date(term.end_date),
      description: term.description || '',
      is_active: term.is_active,
      is_published: term.is_published,
    });
    setEditingTerm(term);
    setShowCreateModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Please enter a term name');
      return;
    }

    if (!orgId || !user?.id) {
      Alert.alert('Error', 'Organization or user not found');
      return;
    }

    try {
      const supabase = assertSupabase();
      
      const termData = {
        preschool_id: orgId,
        created_by: user.id,
        name: formData.name.trim(),
        academic_year: formData.academic_year,
        term_number: formData.term_number,
        start_date: formData.start_date.toISOString().split('T')[0],
        end_date: formData.end_date.toISOString().split('T')[0],
        description: formData.description.trim() || null,
        is_active: formData.is_active,
        is_published: formData.is_published,
      };

      if (editingTerm) {
        const { error } = await supabase
          .from('academic_terms')
          .update(termData)
          .eq('id', editingTerm.id);
        
        if (error) throw error;
        Alert.alert('Success', 'Term updated successfully');
      } else {
        const { error } = await supabase
          .from('academic_terms')
          .insert(termData);
        
        if (error) throw error;
        Alert.alert('Success', 'Term created successfully');
      }

      setShowCreateModal(false);
      fetchTerms();
    } catch (error: any) {
      console.error('Error saving term:', error);
      Alert.alert('Error', error.message || 'Failed to save term');
    }
  };

  const handleDelete = (term: AcademicTerm) => {
    Alert.alert(
      'Delete Term',
      `Are you sure you want to delete "${term.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = assertSupabase();
              const { error } = await supabase
                .from('academic_terms')
                .delete()
                .eq('id', term.id);
              
              if (error) throw error;
              Alert.alert('Success', 'Term deleted successfully');
              fetchTerms();
            } catch (error: any) {
              console.error('Error deleting term:', error);
              Alert.alert('Error', 'Failed to delete term');
            }
          },
        },
      ]
    );
  };

  const handleTogglePublish = async (term: AcademicTerm) => {
    try {
      const supabase = assertSupabase();
      const { error } = await supabase
        .from('academic_terms')
        .update({ is_published: !term.is_published })
        .eq('id', term.id);
      
      if (error) throw error;
      fetchTerms();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update term');
    }
  };

  const groupedTerms = terms.reduce((acc, term) => {
    const year = term.academic_year;
    if (!acc[year]) acc[year] = [];
    acc[year].push(term);
    return acc;
  }, {} as Record<number, AcademicTerm[]>);

  return (
    <DesktopLayout role="principal">
      <Stack.Screen
        options={{
          title: 'Year Planner',
          headerShown: true,
        }}
      />
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.addButtonText}>New Term</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : Object.keys(groupedTerms).length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={64} color={theme.textSecondary} />
            <Text style={styles.emptyText}>No Terms Planned</Text>
            <Text style={styles.emptySubtext}>Start by creating your first academic term</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={openCreateModal}>
              <Text style={styles.emptyButtonText}>Create First Term</Text>
            </TouchableOpacity>
          </View>
        ) : (
          Object.entries(groupedTerms)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([year, yearTerms]) => (
              <View key={year} style={styles.yearSection}>
                <Text style={styles.yearTitle}>Academic Year {year}</Text>
                {yearTerms.map((term) => (
                  <View
                    key={term.id}
                    style={[
                      styles.termCard,
                      term.is_active && styles.termCardActive,
                    ]}
                  >
                    <View style={styles.termHeader}>
                      <View style={styles.termInfo}>
                        <Text style={styles.termName}>{term.name}</Text>
                        <View style={styles.badges}>
                          {term.is_active && (
                            <View style={[styles.badge, styles.badgeActive]}>
                              <Text style={styles.badgeText}>Active</Text>
                            </View>
                          )}
                          {term.is_published && (
                            <View style={[styles.badge, styles.badgePublished]}>
                              <Text style={styles.badgeText}>Published</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={styles.termActions}>
                        <TouchableOpacity
                          onPress={() => handleTogglePublish(term)}
                          style={styles.iconButton}
                        >
                          <Ionicons
                            name={term.is_published ? 'checkmark-circle' : 'checkmark-circle-outline'}
                            size={24}
                            color={term.is_published ? '#10b981' : theme.textSecondary}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => openEditModal(term)}
                          style={styles.iconButton}
                        >
                          <Ionicons name="create-outline" size={24} color={theme.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDelete(term)}
                          style={styles.iconButton}
                        >
                          <Ionicons name="trash-outline" size={24} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.termDates}>
                      {new Date(term.start_date).toLocaleDateString()} - {new Date(term.end_date).toLocaleDateString()}
                    </Text>
                    {term.description && (
                      <Text style={styles.termDescription}>{term.description}</Text>
                    )}
                  </View>
                ))}
              </View>
            ))
        )}

        {/* Create/Edit Modal */}
        <Modal
          visible={showCreateModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowCreateModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {editingTerm ? 'Edit Term' : 'Create New Term'}
                </Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>Term Name *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                    value={formData.name}
                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                    placeholder="e.g., Term 1, First Semester"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.label, { color: theme.text }]}>Academic Year</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                      value={formData.academic_year.toString()}
                      onChangeText={(text) => setFormData({ ...formData, academic_year: Number(text) || new Date().getFullYear() })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.label, { color: theme.text }]}>Term Number</Text>
                    <View style={styles.pickerContainer}>
                      {[1, 2, 3, 4].map((num) => (
                        <TouchableOpacity
                          key={num}
                          style={[
                            styles.pickerOption,
                            formData.term_number === num && styles.pickerOptionSelected,
                            { backgroundColor: formData.term_number === num ? theme.primary : theme.background },
                          ]}
                          onPress={() => setFormData({ ...formData, term_number: num })}
                        >
                          <Text
                            style={[
                              styles.pickerOptionText,
                              { color: formData.term_number === num ? '#fff' : theme.text },
                            ]}
                          >
                            Term {num}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.label, { color: theme.text }]}>Start Date</Text>
                    <TouchableOpacity
                      style={[styles.input, { backgroundColor: theme.background }]}
                      onPress={() => setShowStartDatePicker(true)}
                    >
                      <Text style={{ color: theme.text }}>
                        {formData.start_date.toLocaleDateString()}
                      </Text>
                    </TouchableOpacity>
                    {showStartDatePicker && (
                      <DateTimePicker
                        value={formData.start_date}
                        mode="date"
                        display="default"
                        onChange={(event, date) => {
                          setShowStartDatePicker(false);
                          if (date) setFormData({ ...formData, start_date: date });
                        }}
                      />
                    )}
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.label, { color: theme.text }]}>End Date</Text>
                    <TouchableOpacity
                      style={[styles.input, { backgroundColor: theme.background }]}
                      onPress={() => setShowEndDatePicker(true)}
                    >
                      <Text style={{ color: theme.text }}>
                        {formData.end_date.toLocaleDateString()}
                      </Text>
                    </TouchableOpacity>
                    {showEndDatePicker && (
                      <DateTimePicker
                        value={formData.end_date}
                        mode="date"
                        display="default"
                        onChange={(event, date) => {
                          setShowEndDatePicker(false);
                          if (date) setFormData({ ...formData, end_date: date });
                        }}
                      />
                    )}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>Description (Optional)</Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.textArea,
                      { backgroundColor: theme.background, color: theme.text },
                    ]}
                    value={formData.description}
                    onChangeText={(text) => setFormData({ ...formData, description: text })}
                    placeholder="Add any notes about this term..."
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.checkboxRow}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  >
                    <Ionicons
                      name={formData.is_active ? 'checkbox' : 'checkbox-outline'}
                      size={24}
                      color={formData.is_active ? theme.primary : theme.textSecondary}
                    />
                    <Text style={[styles.checkboxLabel, { color: theme.text }]}>
                      Set as Active Term
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.checkboxRow}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => setFormData({ ...formData, is_published: !formData.is_published })}
                  >
                    <Ionicons
                      name={formData.is_published ? 'checkbox' : 'checkbox-outline'}
                      size={24}
                      color={formData.is_published ? theme.primary : theme.textSecondary}
                    />
                    <Text style={[styles.checkboxLabel, { color: theme.text }]}>
                      Publish to Teachers
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={() => setShowCreateModal(false)}
                >
                  <Text style={styles.buttonSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={handleSubmit}
                >
                  <Text style={styles.buttonPrimaryText}>
                    {editingTerm ? 'Update Term' : 'Create Term'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </DesktopLayout>
  );
}

const createStyles = (theme: any, topInset: number, bottomInset: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      padding: 16,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 8,
      gap: 8,
    },
    addButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 16,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    },
    empty: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    },
    emptyText: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      marginTop: 16,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 24,
      textAlign: 'center',
    },
    emptyButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    emptyButtonText: {
      color: '#fff',
      fontWeight: '600',
    },
    yearSection: {
      marginBottom: 24,
      paddingHorizontal: 16,
    },
    yearTitle: {
      fontSize: 24,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 16,
    },
    termCard: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    termCardActive: {
      borderWidth: 2,
      borderColor: theme.primary,
    },
    termHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    termInfo: {
      flex: 1,
    },
    termName: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    badges: {
      flexDirection: 'row',
      gap: 8,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    badgeActive: {
      backgroundColor: theme.primary,
    },
    badgePublished: {
      backgroundColor: '#10b981',
    },
    badgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    termActions: {
      flexDirection: 'row',
      gap: 8,
    },
    iconButton: {
      padding: 4,
    },
    termDates: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    termDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 8,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      maxWidth: 600,
      maxHeight: '90%',
      borderRadius: 16,
      overflow: 'hidden',
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
      fontWeight: '600',
    },
    modalBody: {
      padding: 20,
      maxHeight: 500,
    },
    formGroup: {
      marginBottom: 16,
    },
    formRow: {
      flexDirection: 'row',
      gap: 12,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    pickerContainer: {
      flexDirection: 'row',
      gap: 8,
    },
    pickerOption: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    pickerOptionSelected: {
      borderWidth: 2,
      borderColor: theme.primary,
    },
    pickerOptionText: {
      fontSize: 14,
      fontWeight: '500',
    },
    checkboxRow: {
      marginBottom: 12,
    },
    checkbox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    checkboxLabel: {
      fontSize: 14,
    },
    modalFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    button: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    buttonPrimary: {
      backgroundColor: theme.primary,
    },
    buttonSecondary: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    buttonPrimaryText: {
      color: '#fff',
      fontWeight: '600',
    },
    buttonSecondaryText: {
      color: theme.text,
      fontWeight: '600',
    },
  });
