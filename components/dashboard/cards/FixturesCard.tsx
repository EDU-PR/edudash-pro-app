import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { DashboardCard } from './DashboardCard';
import { useTheme } from '@/contexts/ThemeContext';

export function FixturesCard() {
  const { theme } = useTheme();

  // TODO: Replace with real fixtures data
  const fixtures = [
    {
      opponent: 'Springfield FC',
      date: 'Sat, May 18',
      time: '3:00 PM',
      venue: 'Home',
      status: 'upcoming',
    },
    {
      opponent: 'Riverside United',
      date: 'Sat, May 25',
      time: '11:00 AM',
      venue: 'Away',
      status: 'upcoming',
    },
  ];

  return (
    <DashboardCard title="Upcoming Fixtures" icon="trophy-outline">
      <View style={styles.list}>
        {fixtures.map((item, idx) => (
          <View
            key={idx}
            style={[
              styles.item,
              { backgroundColor: theme.colors?.background || theme.background },
            ]}
          >
            <View style={styles.header}>
              <Text style={[styles.opponent, { color: theme.text }]}>{item.opponent}</Text>
              <View
                style={[
                  styles.venueBadge,
                  {
                    backgroundColor:
                      item.venue === 'Home'
                        ? theme.colors?.success || theme.success || '#10b981'
                        : theme.colors?.info || theme.info || '#3b82f6',
                  },
                ]}
              >
                <Text style={styles.venueText}>{item.venue}</Text>
              </View>
            </View>
            <Text style={[styles.datetime, { color: theme.textSecondary }]}>
              {item.date} • {item.time}
            </Text>
          </View>
        ))}
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  item: {
    padding: 12,
    borderRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  opponent: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  venueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  venueText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  datetime: {
    fontSize: 12,
    opacity: 0.6,
  },
});
