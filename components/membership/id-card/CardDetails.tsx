/**
 * Card Details Component
 * Display card metadata and member information
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { OrganizationMember, MemberIDCard } from '@/components/membership/types';

interface CardDetailsProps {
  member: OrganizationMember;
  card: MemberIDCard;
  theme: any;
}

export function CardDetails({ member, card, theme }: CardDetailsProps) {
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Card Details</Text>
      <View style={[styles.detailsCard, { backgroundColor: theme.card }]}>
        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="card-outline" size={18} color={theme.textSecondary} />
          </View>
          <View style={styles.detailContent}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Card Number</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>{card.card_number}</Text>
          </View>
        </View>

        <View style={[styles.detailDivider, { backgroundColor: theme.border }]} />

        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="person-outline" size={18} color={theme.textSecondary} />
          </View>
          <View style={styles.detailContent}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Member Number</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>{member.member_number}</Text>
          </View>
        </View>

        <View style={[styles.detailDivider, { backgroundColor: theme.border }]} />

        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
          </View>
          <View style={styles.detailContent}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Issue Date</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>{formatDate(card.issue_date)}</Text>
          </View>
        </View>

        <View style={[styles.detailDivider, { backgroundColor: theme.border }]} />

        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="time-outline" size={18} color={theme.textSecondary} />
          </View>
          <View style={styles.detailContent}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Expiry Date</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>{formatDate(card.expiry_date)}</Text>
          </View>
        </View>

        <View style={[styles.detailDivider, { backgroundColor: theme.border }]} />

        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="shield-checkmark-outline" size={18} color={theme.textSecondary} />
          </View>
          <View style={styles.detailContent}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Verifications</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>{card.verification_count} scans</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  detailsCard: {
    borderRadius: 14,
    padding: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  detailIcon: {
    width: 36,
    alignItems: 'center',
  },
  detailContent: {
    flex: 1,
    marginLeft: 4,
  },
  detailLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  detailDivider: {
    height: 1,
    marginHorizontal: 12,
  },
});
