/**
 * Filter modal component for teachers directory
 */

import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { 
  FilterOptions, 
  FILTER_SUBJECTS, 
  EMPLOYMENT_STATUSES,
} from './teachers-directory.types';
import { teachersDirectoryStyles as styles } from './teachers-directory.styles';

interface TeacherFilterModalProps {
  visible: boolean;
  filters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
  onClearFilters: () => void;
  onClose: () => void;
}

export function TeacherFilterModal({
  visible,
  filters,
  onFilterChange,
  onClearFilters,
  onClose,
}: TeacherFilterModalProps) {
  const toggleSubject = (subject: string) => {
    onFilterChange({
      ...filters,
      subjects: filters.subjects.includes(subject)
        ? filters.subjects.filter(s => s !== subject)
        : [...filters.subjects, subject]
    });
  };

  const toggleEmploymentStatus = (status: string) => {
    onFilterChange({
      ...filters,
      employmentStatus: filters.employmentStatus.includes(status)
        ? filters.employmentStatus.filter(s => s !== status)
        : [...filters.employmentStatus, status]
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Teachers</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.light.text} />
            </TouchableOpacity>
          </View>

          <ScrollView>
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Subjects</Text>
              <View style={styles.filterOptions}>
                {FILTER_SUBJECTS.map(subject => (
                  <TouchableOpacity
                    key={subject}
                    style={[
                      styles.filterOption, 
                      filters.subjects.includes(subject) && styles.filterOptionSelected
                    ]}
                    onPress={() => toggleSubject(subject)}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.subjects.includes(subject) && styles.filterOptionTextSelected
                    ]}>
                      {subject}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Employment Status</Text>
              <View style={styles.filterOptions}>
                {EMPLOYMENT_STATUSES.map(status => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.filterOption, 
                      filters.employmentStatus.includes(status) && styles.filterOptionSelected
                    ]}
                    onPress={() => toggleEmploymentStatus(status)}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.employmentStatus.includes(status) && styles.filterOptionTextSelected
                    ]}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.clearFiltersButton} onPress={onClearFilters}>
              <Text style={styles.clearFiltersText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyFiltersButton} onPress={onClose}>
              <Text style={styles.applyFiltersText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
