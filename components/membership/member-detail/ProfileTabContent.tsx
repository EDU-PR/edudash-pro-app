/**
 * Profile Tab Content Component
 * Contact info, personal details, emergency contact, notes
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ProfileTabProps } from './types';

export function ProfileTabContent({ member, theme }: ProfileTabProps) {
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <View>
      {/* Contact Info */}
      <View style={[styles.infoSection, { backgroundColor: theme.card }]}>
        <Text style={[styles.infoSectionTitle, { color: theme.text }]}>Contact Information</Text>
        
        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={20} color={theme.textSecondary} />
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Email</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{member.email}</Text>
          </View>
        </View>
        
        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={20} color={theme.textSecondary} />
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Phone</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{member.phone}</Text>
          </View>
        </View>
        
        {(member.address_line1 || member.physical_address) && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color={theme.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Address</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {member.address_line1 || member.physical_address}
                {member.address_line2 && `\n${member.address_line2}`}
                {'\n'}{member.city}, {member.province} {member.postal_code}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Personal Info */}
      <View style={[styles.infoSection, { backgroundColor: theme.card }]}>
        <Text style={[styles.infoSectionTitle, { color: theme.text }]}>Personal Details</Text>
        
        {member.date_of_birth && (
          <View style={styles.infoRow}>
            <Ionicons name="gift-outline" size={20} color={theme.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Date of Birth</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{formatDate(member.date_of_birth)}</Text>
            </View>
          </View>
        )}
        
        {member.id_number && (
          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={20} color={theme.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>ID Number</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {member.id_number.replace(/(\d{6})(\d{4})(\d{3})/, '$1 $2 $3')}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Emergency Contact */}
      {member.emergency_contact_name && (
        <View style={[styles.infoSection, { backgroundColor: theme.card }]}>
          <Text style={[styles.infoSectionTitle, { color: theme.text }]}>Emergency Contact</Text>
          
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={20} color={theme.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Name</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{member.emergency_contact_name}</Text>
            </View>
          </View>
          
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color={theme.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Phone</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{member.emergency_contact_phone}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Notes */}
      {member.notes && (
        <View style={[styles.infoSection, { backgroundColor: theme.card }]}>
          <Text style={[styles.infoSectionTitle, { color: theme.text }]}>Notes</Text>
          <Text style={[styles.notesText, { color: theme.textSecondary }]}>{member.notes}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  infoSection: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  infoSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
