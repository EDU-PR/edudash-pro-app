/**
 * Parent Contact Section Component
 * Shows parent/guardian info with call, SMS, email actions
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StudentDetail } from './types';

interface ParentContactSectionProps {
  student: StudentDetail;
  theme: any;
}

export const ParentContactSection: React.FC<ParentContactSectionProps> = ({
  student,
  theme,
}) => {
  const styles = createStyles(theme);

  const handleContactParent = (type: 'call' | 'email' | 'sms') => {
    if (!student?.parent_phone && !student?.parent_email) {
      Alert.alert('No Contact', 'No parent contact information available');
      return;
    }

    switch (type) {
      case 'call':
        if (student.parent_phone) {
          Linking.openURL(`tel:${student.parent_phone}`);
        }
        break;
      case 'email':
        if (student.parent_email) {
          Linking.openURL(`mailto:${student.parent_email}`);
        }
        break;
      case 'sms':
        if (student.parent_phone) {
          Linking.openURL(`sms:${student.parent_phone}`);
        }
        break;
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Parent/Guardian</Text>
      {student.parent_name ? (
        <View>
          <View style={styles.contactInfo}>
            <Text style={styles.parentName}>{student.parent_name}</Text>
            {student.parent_email && (
              <Text style={styles.contactDetail}>{student.parent_email}</Text>
            )}
            {student.parent_phone && (
              <Text style={styles.contactDetail}>{student.parent_phone}</Text>
            )}
          </View>
          
          <View style={styles.contactActions}>
            <TouchableOpacity 
              style={styles.contactButton}
              onPress={() => handleContactParent('call')}
            >
              <Ionicons name="call" size={20} color="#10B981" />
              <Text style={styles.contactButtonText}>Call</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.contactButton}
              onPress={() => handleContactParent('sms')}
            >
              <Ionicons name="chatbubble" size={20} color="#007AFF" />
              <Text style={styles.contactButtonText}>SMS</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.contactButton}
              onPress={() => handleContactParent('email')}
            >
              <Ionicons name="mail" size={20} color="#8B5CF6" />
              <Text style={styles.contactButtonText}>Email</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={styles.noContact}>No parent contact information</Text>
      )}
    </View>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  section: {
    margin: 16,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: theme.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 16,
  },
  contactInfo: {
    marginBottom: 16,
  },
  parentName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  contactDetail: {
    fontSize: 16,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  contactActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  contactButton: {
    alignItems: 'center',
    padding: 12,
  },
  contactButtonText: {
    fontSize: 12,
    color: theme.text,
    marginTop: 4,
  },
  noContact: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
});
