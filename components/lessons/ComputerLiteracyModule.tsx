/**
 * Computer Literacy Module Component
 * 
 * Provides computer literacy curriculum and activities
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

interface ComputerLiteracyModuleProps {
  ageGroup: string;
  onSelectModule?: (moduleId: string) => void;
}

const COMPUTER_LITERACY_MODULES = [
  {
    id: 'mouse-basics',
    title: 'Mouse Basics',
    description: 'Learn to click, drag, and navigate with a mouse',
    icon: 'hand-left' as const,
    ageGroup: '3-6',
  },
  {
    id: 'keyboard-intro',
    title: 'Keyboard Introduction',
    description: 'Find letters and numbers on the keyboard',
    icon: 'keyboard' as const,
    ageGroup: '4-6',
  },
  {
    id: 'app-navigation',
    title: 'App Navigation',
    description: 'Learn to open, close, and navigate apps',
    icon: 'apps' as const,
    ageGroup: '4-6',
  },
  {
    id: 'online-safety',
    title: 'Online Safety Basics',
    description: 'Simple rules for staying safe online',
    icon: 'shield-checkmark' as const,
    ageGroup: '5-6',
  },
];

export function ComputerLiteracyModule({ ageGroup, onSelectModule }: ComputerLiteracyModuleProps) {
  const { theme } = useTheme();

  const filteredModules = COMPUTER_LITERACY_MODULES.filter(
    module => {
      const [minAge, maxAge] = module.ageGroup.split('-').map(Number);
      const [childMin, childMax] = ageGroup.split('-').map(Number);
      return childMin >= minAge && childMax <= maxAge;
    }
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>Computer Literacy Modules</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Age-appropriate computer skills for {ageGroup} year olds
      </Text>

      <ScrollView style={styles.modulesList}>
        {filteredModules.map((module) => (
          <TouchableOpacity
            key={module.id}
            style={[styles.moduleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => onSelectModule?.(module.id)}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#cffafe' }]}>
              <Ionicons name={module.icon} size={24} color="#06b6d4" />
            </View>
            <View style={styles.moduleContent}>
              <Text style={[styles.moduleTitle, { color: theme.text }]}>{module.title}</Text>
              <Text style={[styles.moduleDescription, { color: theme.textSecondary }]}>
                {module.description}
              </Text>
              <Text style={[styles.moduleAge, { color: theme.textSecondary }]}>
                Ages: {module.ageGroup}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  modulesList: {
    flex: 1,
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  moduleContent: {
    flex: 1,
  },
  moduleTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  moduleDescription: {
    fontSize: 14,
    marginBottom: 4,
  },
  moduleAge: {
    fontSize: 12,
  },
});
