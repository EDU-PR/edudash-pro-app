/**
 * Parent Contact Section Component
 * Shows parent/guardian info with call, SMS, email actions.
 * Principals/admins can link a second parent by email.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StudentDetail } from './types';
import type { ThemeColors } from '@/contexts/ThemeContext';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { assertSupabase } from '@/lib/supabase';

interface ParentContactSectionProps {
  student: StudentDetail;
  theme: ThemeColors;
  /** When true, show "Link second parent by email" block (principal/admin) */
  canManageGuardian?: boolean;
  /** Called after successfully linking a guardian so parent screen can refetch */
  onGuardianLinked?: () => void;
}

export const ParentContactSection: React.FC<ParentContactSectionProps> = ({
  student,
  theme,
  canManageGuardian = false,
  onGuardianLinked,
}) => {
  const styles = createStyles(theme);
  const { showAlert, alertProps } = useAlertModal();
  const [linkEmail, setLinkEmail] = useState('');
  const [linkingGuardian, setLinkingGuardian] = useState(false);

  const handleLinkGuardianByEmail = async () => {
    const email = linkEmail.trim().toLowerCase();
    if (!email) {
      showAlert({ title: 'Email required', message: 'Enter the second parent\'s email address.', type: 'warning' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert({ title: 'Invalid email', message: 'Please enter a valid email address.', type: 'warning' });
      return;
    }
    setLinkingGuardian(true);
    try {
      const supabase = assertSupabase();
      const { data, error } = await supabase.rpc('principal_link_guardian_by_email', {
        p_student_id: student.id,
        p_email: email,
      });
      if (error) {
        showAlert({ title: 'Link failed', message: error.message || 'Could not link guardian.', type: 'error' });
        return;
      }
      const result = data as { error?: string } | null;
      if (result?.error) {
        showAlert({ title: 'Link failed', message: result.error, type: 'error' });
        return;
      }
      showAlert({
        title: 'Second parent linked',
        message: 'The second parent/guardian has been linked. They can now access this student.',
        type: 'success',
        buttons: [{ text: 'OK', onPress: () => { setLinkEmail(''); onGuardianLinked?.(); } }],
      });
    } finally {
      setLinkingGuardian(false);
    }
  };

  const handleContact = (
    type: 'call' | 'email' | 'sms',
    contact: { phone?: string | null; email?: string | null; label: string }
  ) => {
    if (!contact.phone && !contact.email) {
      showAlert({
        title: 'No Contact',
        message: `No ${contact.label.toLowerCase()} contact information available.`,
        type: 'warning',
      });
      return;
    }

    switch (type) {
      case 'call':
        if (contact.phone) {
          Linking.openURL(`tel:${contact.phone}`);
        }
        break;
      case 'email':
        if (contact.email) {
          Linking.openURL(`mailto:${contact.email}`);
        }
        break;
      case 'sms':
        if (contact.phone) {
          Linking.openURL(`sms:${contact.phone}`);
        }
        break;
    }
  };

  const parentContact = {
    label: 'Parent',
    name: student.parent_name,
    email: student.parent_email,
    phone: student.parent_phone,
  };

  const guardianContact = {
    label: 'Guardian',
    name: student.guardian_name,
    email: student.guardian_email,
    phone: student.guardian_phone,
  };

  const showGuardian =
    !!(guardianContact.name || guardianContact.email || guardianContact.phone) &&
    student.guardian_id !== student.parent_id;

  const canAddSecondGuardian = canManageGuardian && !showGuardian;

  const renderContactCard = (contact: typeof parentContact) => (
    <View style={styles.contactCard} key={contact.label}>
      <Text style={styles.contactLabel}>{contact.label}</Text>
      {contact.name ? (
        <>
          <Text style={styles.parentName}>{contact.name}</Text>
          {contact.email && <Text style={styles.contactDetail}>{contact.email}</Text>}
          {contact.phone && <Text style={styles.contactDetail}>{contact.phone}</Text>}
        </>
      ) : (
        <Text style={styles.noContact}>{`No ${contact.label.toLowerCase()} contact information`}</Text>
      )}

      {(contact.phone || contact.email) && (
        <View style={styles.contactActions}>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => handleContact('call', contact)}
          >
            <Ionicons name="call" size={20} color="#10B981" />
            <Text style={styles.contactButtonText}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => handleContact('sms', contact)}
          >
            <Ionicons name="chatbubble" size={20} color="#007AFF" />
            <Text style={styles.contactButtonText}>SMS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => handleContact('email', contact)}
          >
            <Ionicons name="mail" size={20} color="#8B5CF6" />
            <Text style={styles.contactButtonText}>Email</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Parent & Guardian Contacts</Text>
        {renderContactCard(parentContact)}
        {showGuardian && renderContactCard(guardianContact)}
        {!parentContact.name &&
          !parentContact.email &&
          !parentContact.phone &&
          !showGuardian && (
            <Text style={styles.noContact}>No parent or guardian contact information</Text>
          )}
        {canAddSecondGuardian && (
          <View style={styles.linkGuardianCard}>
            <Text style={styles.linkGuardianTitle}>Add second parent or guardian</Text>
            <Text style={styles.linkGuardianHint}>Link by their account email</Text>
            <TextInput
              style={styles.linkGuardianInput}
              placeholder="Second parent's email"
              placeholderTextColor={theme.textSecondary}
              value={linkEmail}
              onChangeText={setLinkEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!linkingGuardian}
            />
            <TouchableOpacity
              style={[styles.linkGuardianButton, linkingGuardian && styles.linkGuardianButtonDisabled]}
              onPress={handleLinkGuardianByEmail}
              disabled={linkingGuardian}
            >
              {linkingGuardian ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={styles.linkGuardianButtonContent}>
                  <Ionicons name="person-add" size={18} color="#fff" style={styles.linkGuardianButtonIcon} />
                  <Text style={styles.linkGuardianButtonText}>Link by email</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
      <AlertModal {...alertProps} />
    </>
  );
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
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
  contactCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  contactLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: theme.textSecondary,
    marginBottom: 6,
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
  linkGuardianCard: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  linkGuardianTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  linkGuardianHint: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 10,
  },
  linkGuardianInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: theme.text,
    marginBottom: 10,
  },
  linkGuardianButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  linkGuardianButtonDisabled: {
    opacity: 0.7,
  },
  linkGuardianButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkGuardianButtonIcon: {
    marginRight: 8,
  },
  linkGuardianButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
