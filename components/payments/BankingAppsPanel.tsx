import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { ResolvedBankApp } from '@/lib/payments/bankingApps';

interface BankingAppsPanelProps {
  banks: ResolvedBankApp[];
  onSelect: (bank: ResolvedBankApp) => void;
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
}

const getBadgeFontSize = (label: string) => {
  if (label.length <= 2) return 18;
  if (label.length === 3) return 14;
  return 12;
};

export function BankingAppsPanel({
  banks,
  onSelect,
  title = 'Banking Apps',
  subtitle = 'Open your banking app to complete payment',
  emptyMessage = 'No banking apps are configured for this payment flow.',
}: BankingAppsPanelProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>

      {banks.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{emptyMessage}</Text>
      ) : (
        <View style={styles.grid}>
          {banks.map((bank) => (
            <TouchableOpacity
              key={bank.id}
              style={[
                styles.bankTile,
                {
                  backgroundColor: theme.background,
                  borderColor: bank.detected ? theme.primary : theme.border,
                },
              ]}
              onPress={() => onSelect(bank)}
              activeOpacity={0.75}
            >
              <View style={[styles.bankBadge, { backgroundColor: bank.color }]}>
                <Text style={[styles.bankBadgeText, { fontSize: getBadgeFontSize(bank.shortName) }]}>
                  {bank.shortName}
                </Text>
              </View>
              <Text style={[styles.bankName, { color: theme.text }]} numberOfLines={2}>
                {bank.name}
              </Text>
              <Text
                style={[
                  styles.bankStatus,
                  { color: bank.detected ? theme.primary : theme.textSecondary },
                ]}
              >
                {bank.detected ? 'Detected' : 'Manual Open'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  bankTile: {
    width: '31%',
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  bankBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankBadgeText: {
    color: '#fff',
    fontWeight: '700',
  },
  bankName: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  bankStatus: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
