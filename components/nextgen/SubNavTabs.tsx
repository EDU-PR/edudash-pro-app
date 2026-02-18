import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface SubNavTabsProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabPress: (tabId: string) => void;
}

/**
 * Horizontal sub-navigation tabs rendered below the header.
 * Matches the next-gen design mockup (Dashboard | Messages | Grades | Account).
 */
export default function SubNavTabs({ tabs, activeTab, onTabPress }: SubNavTabsProps) {
  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onTabPress(tab.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
            {isActive && <View style={styles.indicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 2,
    gap: 4,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabActive: {},
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(234,240,255,0.50)',
  },
  labelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  indicator: {
    marginTop: 4,
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#3C8E62',
  },
});
