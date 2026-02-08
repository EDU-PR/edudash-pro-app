/**
 * TodayHighlights — Horizontally scrollable "pulse" cards
 * 
 * Shows today's key metrics (attendance, homework, next event, fees)
 * in a horizontally scrolling strip at the top of the parent dashboard.
 * 
 * ≤130 lines — WARP-compliant presentational component.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 380;
const isTablet = screenWidth > 768;

export interface TodayHighlight {
  id: string;
  label: string;
  value: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

interface TodayHighlightsProps {
  highlights: TodayHighlight[];
}

export const TodayHighlights: React.FC<TodayHighlightsProps> = ({ highlights }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {t('dashboard.today_focus', { defaultValue: 'Today' })}
        </Text>
        <Text style={[styles.headerHint, { color: theme.textSecondary }]}>
          {t('dashboard.hints.today_focus', { defaultValue: 'Academic highlights at a glance.' })}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollRow}
      >
        {highlights.map((item) => (
          <View
            key={item.id}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
          >
            <View style={[styles.iconWrap, { backgroundColor: item.color + '1A' }]}>
              <Ionicons name={item.icon} size={18} color={item.color} />
            </View>
            <Text style={[styles.label, { color: theme.textSecondary }]}>{item.label}</Text>
            <Text style={[styles.value, { color: theme.text }]}>{item.value}</Text>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>{item.sub}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: '700',
  },
  headerHint: { fontSize: 12 },
  scrollRow: { paddingHorizontal: 2 },
  card: {
    minWidth: isSmallScreen ? 150 : 180,
    borderRadius: 14,
    padding: 12,
    marginRight: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: '700',
    marginTop: 4,
  },
  sub: { fontSize: 12, marginTop: 2 },
});

export default TodayHighlights;
