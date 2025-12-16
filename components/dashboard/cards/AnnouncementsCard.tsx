import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { DashboardCard } from './DashboardCard';
import { useTerm } from '@/contexts/TerminologyContext';
import { useTheme } from '@/contexts/ThemeContext';

export function AnnouncementsCard() {
  const organizationTerm = useTerm('organization');
  const { theme } = useTheme();

  // TODO: Replace with real data from Supabase
  const announcements = [
    {
      id: '1',
      title: `${organizationTerm} Holiday Notice`,
      date: '2 hours ago',
      preview: 'Important update regarding upcoming holidays...',
    },
    {
      id: '2',
      title: 'New Schedule Changes',
      date: 'Yesterday',
      preview: 'Please review the updated schedule for next week...',
    },
  ];

  return (
    <DashboardCard title="Announcements" icon="megaphone-outline">
      <View style={styles.list}>
        {announcements.map((item) => (
          <View
            key={item.id}
            style={[styles.item, { borderBottomColor: theme.colors.border }]}
          >
            <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
            <Text style={[styles.itemDate, { color: theme.textSecondary }]}>{item.date}</Text>
            <Text style={[styles.itemPreview, { color: theme.text }]} numberOfLines={2}>
              {item.preview}
            </Text>
          </View>
        ))}
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  item: {
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemDate: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 4,
  },
  itemPreview: {
    fontSize: 13,
    opacity: 0.8,
  },
});
