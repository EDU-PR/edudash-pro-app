/**
 * K12 Recent Registrations Component
 * Displays list of recent aftercare registrations
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import type { Registration } from './types';
import { getStatusColor, formatStatus } from './types';

interface K12RecentRegistrationsProps {
  registrations: Registration[];
  theme: any;
}

export function K12RecentRegistrations({ registrations, theme }: K12RecentRegistrationsProps) {
  const styles = createStyles(theme);

  if (registrations.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Registrations</Text>
        <TouchableOpacity onPress={() => router.push('/screens/aftercare-admin')}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>
      {registrations.map(reg => (
        <View key={reg.id} style={styles.registrationItem}>
          <View style={styles.registrationAvatar}>
            <Text style={styles.registrationAvatarText}>
              {reg.child_first_name?.[0] || '?'}
            </Text>
          </View>
          <View style={styles.registrationInfo}>
            <Text style={styles.registrationName}>
              {reg.child_first_name} {reg.child_last_name}
            </Text>
            <Text style={styles.registrationGrade}>Grade {reg.child_grade}</Text>
          </View>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(reg.status) + '20' }
          ]}>
            <Text style={[styles.statusText, { color: getStatusColor(reg.status) }]}>
              {formatStatus(reg.status)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  section: {
    padding: 20,
    paddingTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  viewAllText: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '600',
  },
  registrationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  registrationAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F620',
    alignItems: 'center',
    justifyContent: 'center',
  },
  registrationAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6',
  },
  registrationInfo: {
    flex: 1,
  },
  registrationName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  registrationGrade: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default K12RecentRegistrations;
