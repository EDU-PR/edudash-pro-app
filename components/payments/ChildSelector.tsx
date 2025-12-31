import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PaymentChild } from '@/types/payments';

interface ChildSelectorProps {
  children: PaymentChild[];
  selectedChildId: string | null;
  onSelectChild: (childId: string) => void;
  theme: any;
}

export function ChildSelector({ children, selectedChildId, onSelectChild, theme }: ChildSelectorProps) {
  if (children.length <= 1) return null;
  
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Select Child</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {children.map(child => (
          <TouchableOpacity
            key={child.id}
            style={[styles.childButton, selectedChildId === child.id && styles.childButtonActive]}
            onPress={() => onSelectChild(child.id)}
          >
            <View style={[styles.avatar, selectedChildId === child.id && styles.avatarActive]}>
              <Text style={styles.avatarText}>{child.first_name[0]}</Text>
            </View>
            <Text style={[styles.name, selectedChildId === child.id && styles.nameActive]}>
              {child.first_name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

interface SelectedChildCardProps {
  child: PaymentChild;
  theme: any;
}

export function SelectedChildCard({ child, theme }: SelectedChildCardProps) {
  const styles = createStyles(theme);
  
  return (
    <View style={styles.selectedCard}>
      <View style={styles.selectedRow}>
        <View style={styles.selectedAvatar}>
          <Text style={styles.selectedAvatarText}>{child.first_name[0]}</Text>
        </View>
        <View style={styles.selectedInfo}>
          <Text style={styles.selectedName}>{child.first_name} {child.last_name}</Text>
          <View style={styles.schoolRow}>
            <Ionicons name="school-outline" size={12} color={theme.textSecondary} />
            <Text style={styles.schoolName}>{child.preschool_name || 'School'}</Text>
          </View>
          <View style={styles.referenceRow}>
            <Ionicons name="barcode-outline" size={12} color={theme.primary} />
            <Text style={styles.referenceCode}>Ref: {child.student_code}</Text>
          </View>
        </View>
        {child.payment_verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 13, color: theme.textSecondary, marginBottom: 8 },
  childButton: {
    alignItems: 'center',
    marginRight: 12,
    padding: 8,
    borderRadius: 12,
    backgroundColor: theme.surface,
    minWidth: 70,
  },
  childButtonActive: {
    backgroundColor: theme.primary + '20',
    borderWidth: 1,
    borderColor: theme.primary,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatarActive: { backgroundColor: theme.primary },
  avatarText: { fontSize: 16, fontWeight: '600', color: theme.text },
  name: { fontSize: 12, color: theme.textSecondary },
  nameActive: { color: theme.primary, fontWeight: '600' },
  selectedCard: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  selectedRow: { flexDirection: 'row', alignItems: 'center' },
  selectedAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  selectedAvatarText: { fontSize: 20, fontWeight: '700', color: '#fff' },
  selectedInfo: { flex: 1 },
  selectedName: { fontSize: 18, fontWeight: '600', color: theme.text, marginBottom: 2 },
  schoolRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  schoolName: { fontSize: 12, color: theme.textSecondary },
  referenceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  referenceCode: { fontSize: 12, fontWeight: '600', color: theme.primary },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: { fontSize: 10, color: '#22c55e', fontWeight: '600' },
});
