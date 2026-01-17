// Term Card Component for AI Year Planner
// Displays individual term with collapsible details

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { GeneratedTerm } from './types';

interface TermCardProps {
  term: GeneratedTerm;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function TermCard({ term, isExpanded, onToggleExpand }: TermCardProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.termCard}>
      <TouchableOpacity style={styles.termHeader} onPress={onToggleExpand}>
        <View style={styles.termHeaderLeft}>
          <View style={[styles.termBadge, { backgroundColor: theme.primary }]}>
            <Text style={styles.termBadgeText}>{term.termNumber}</Text>
          </View>
          <View>
            <Text style={styles.termName}>{term.name}</Text>
            <Text style={styles.termDates}>
              {new Date(term.startDate).toLocaleDateString()} - {new Date(term.endDate).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={theme.textSecondary}
        />
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.termContent}>
          {/* Weekly Themes */}
          <View style={styles.termSection}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="calendar-outline" size={16} color={theme.primary} /> Weekly Themes
            </Text>
            {term.weeklyThemes.slice(0, 5).map((week) => (
              <View key={week.week} style={styles.weekItem}>
                <View style={styles.weekNumber}>
                  <Text style={styles.weekNumberText}>W{week.week}</Text>
                </View>
                <View style={styles.weekContent}>
                  <Text style={styles.weekTheme}>{week.theme}</Text>
                  <Text style={styles.weekDescription}>{week.description}</Text>
                </View>
              </View>
            ))}
            {term.weeklyThemes.length > 5 && (
              <Text style={styles.moreItems}>+{term.weeklyThemes.length - 5} more themes</Text>
            )}
          </View>
          
          {/* Excursions */}
          {term.excursions.length > 0 && (
            <View style={styles.termSection}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="bus-outline" size={16} color="#10B981" /> Excursions
              </Text>
              {term.excursions.map((exc, idx) => (
                <View key={idx} style={styles.excursionItem}>
                  <Text style={styles.excursionTitle}>{exc.title}</Text>
                  <Text style={styles.excursionDetail}>{exc.destination}</Text>
                  <Text style={styles.excursionCost}>{exc.estimatedCost}</Text>
                </View>
              ))}
            </View>
          )}
          
          {/* Meetings */}
          {term.meetings.length > 0 && (
            <View style={styles.termSection}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="people-outline" size={16} color="#8B5CF6" /> Meetings
              </Text>
              {term.meetings.map((meeting, idx) => (
                <View key={idx} style={styles.meetingItem}>
                  <Text style={styles.meetingTitle}>{meeting.title}</Text>
                  <Text style={styles.meetingType}>{meeting.type}</Text>
                </View>
              ))}
            </View>
          )}
          
          {/* Special Events */}
          {term.specialEvents.length > 0 && (
            <View style={styles.termSection}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="star-outline" size={16} color="#F59E0B" /> Special Events
              </Text>
              {term.specialEvents.map((event, idx) => (
                <Text key={idx} style={styles.eventItem}>• {event}</Text>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    termCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    termHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
    },
    termHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    termBadge: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    termBadgeText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
    },
    termName: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.text,
    },
    termDates: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    termContent: {
      padding: 16,
      paddingTop: 0,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    termSection: {
      marginTop: 16,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 10,
    },
    weekItem: {
      flexDirection: 'row',
      marginBottom: 10,
    },
    weekNumber: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    weekNumberText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    weekContent: {
      flex: 1,
    },
    weekTheme: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.text,
    },
    weekDescription: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    moreItems: {
      fontSize: 13,
      color: theme.primary,
      fontStyle: 'italic',
    },
    excursionItem: {
      backgroundColor: theme.background,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    excursionTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.text,
    },
    excursionDetail: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    excursionCost: {
      fontSize: 13,
      color: '#10B981',
      fontWeight: '500',
      marginTop: 4,
    },
    meetingItem: {
      backgroundColor: theme.background,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    meetingTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.text,
    },
    meetingType: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
      textTransform: 'capitalize',
    },
    eventItem: {
      fontSize: 14,
      color: theme.text,
      marginBottom: 6,
    },
  });
