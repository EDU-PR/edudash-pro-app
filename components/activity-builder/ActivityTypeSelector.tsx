/**
 * Activity type selection step component
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ActivityType, ACTIVITY_TYPES, ActivityDraft } from './activity-builder.types';
import { activityBuilderStyles as styles } from './activity-builder.styles';

interface ActivityTypeSelectorProps {
  selectedType: ActivityType;
  onSelectType: (type: ActivityType) => void;
}

export function ActivityTypeSelector({ selectedType, onSelectType }: ActivityTypeSelectorProps) {
  const { colors } = useTheme();

  return (
    <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        What type of activity?
      </Text>
      <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        Choose an activity type for your students
      </Text>

      <View style={styles.typeGrid}>
        {ACTIVITY_TYPES.map(actType => (
          <TouchableOpacity
            key={actType.type}
            onPress={() => onSelectType(actType.type)}
            style={[
              styles.typeCard,
              {
                backgroundColor: colors.cardBackground,
                borderColor: selectedType === actType.type ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={styles.typeIcon}>{actType.icon}</Text>
            <Text style={[styles.typeName, { color: colors.text }]}>{actType.name}</Text>
            <Text style={[styles.typeDesc, { color: colors.textSecondary }]}>
              {actType.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
