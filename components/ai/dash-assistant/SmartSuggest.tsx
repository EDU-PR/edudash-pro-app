/**
 * SmartSuggest — Next-Gen Intelligent Quick Actions
 *
 * Replaces static TutorHome buttons with personalized, context-aware
 * suggestions driven by role, time of day, and usage patterns.
 *
 * @module components/ai/dash-assistant/SmartSuggest
 * @max-lines 400
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import {
  type SmartAction,
  getGreeting,
  getStudentActions,
  getTeacherActions,
  getParentActions,
} from './smartSuggestActions';

// Re-export the icon type for the actions file
export type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface SmartSuggestProps {
  role: string;
  schoolType: string;
  onSendMessage: (text: string) => void;
  grade?: string | null;
  learnerName?: string | null;
  isStaff: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const SmartSuggest = React.memo(function SmartSuggest({
  role,
  schoolType,
  onSendMessage,
  grade,
  learnerName,
  isStaff,
}: SmartSuggestProps) {
  const { theme } = useTheme();
  const greeting = useMemo(() => getGreeting(learnerName), [learnerName]);

  const actions = useMemo(() => {
    const st = (schoolType || 'preschool').toLowerCase();
    if (isStaff) return getTeacherActions(st);
    if (role === 'parent') return getParentActions(st);
    return getStudentActions(st, grade);
  }, [role, schoolType, grade, isStaff]);

  const quickActions = useMemo(() => actions.filter(a => a.category === 'quick' || a.category === 'plan'), [actions]);
  const toolActions = useMemo(() => actions.filter(a => a.category === 'tools' || a.category === 'learn'), [actions]);

  const handleAction = useCallback((action: SmartAction) => {
    if (action.route) {
      router.push(action.route as any);
    } else if (action.prompt) {
      onSendMessage(action.prompt);
    }
  }, [onSendMessage]);

  return (
    <ScrollView
      contentContainerStyle={ss.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero greeting */}
      <LinearGradient
        colors={['#0b1220', '#111d33', '#0b1220']}
        style={[ss.hero, { borderColor: theme.border }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={ss.heroInner}>
          <View style={[ss.avatarGlow, { backgroundColor: theme.primary + '30' }]}>
            <LinearGradient
              colors={[theme.primary, '#6366F1']}
              style={ss.avatar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="sparkles" size={24} color="#fff" />
            </LinearGradient>
          </View>
          <View style={ss.heroText}>
            <Text style={[ss.greeting, { color: theme.text }]}>{greeting}</Text>
            <Text style={[ss.subtitle, { color: theme.textSecondary }]}>
              {isStaff
                ? 'What shall we plan today?'
                : role === 'parent'
                  ? 'How can I help your child?'
                  : "What would you like to learn?"}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Quick actions — primary row */}
      <View style={ss.section}>
        <Text style={[ss.sectionLabel, { color: theme.textSecondary }]}>
          {isStaff ? 'Quick Planning' : 'Start Learning'}
        </Text>
        <View style={ss.grid}>
          {quickActions.map(action => (
            <TouchableOpacity
              key={action.id}
              style={[ss.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
              activeOpacity={0.7}
              onPress={() => handleAction(action)}
            >
              <View style={[ss.cardIcon, { backgroundColor: action.color + '18' }]}>
                <Ionicons name={action.icon} size={22} color={action.color} />
              </View>
              <Text style={[ss.cardLabel, { color: theme.text }]} numberOfLines={1}>
                {action.label}
              </Text>
              <Text style={[ss.cardDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                {action.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tools & explore — secondary row */}
      {toolActions.length > 0 && (
        <View style={ss.section}>
          <Text style={[ss.sectionLabel, { color: theme.textSecondary }]}>
            {isStaff ? 'Tools & Resources' : 'Explore More'}
          </Text>
          {toolActions.map(action => (
            <TouchableOpacity
              key={action.id}
              style={[ss.listItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
              activeOpacity={0.7}
              onPress={() => handleAction(action)}
            >
              <View style={[ss.listIcon, { backgroundColor: action.color + '18' }]}>
                <Ionicons name={action.icon} size={18} color={action.color} />
              </View>
              <View style={ss.listText}>
                <Text style={[ss.listLabel, { color: theme.text }]}>{action.label}</Text>
                <Text style={[ss.listDesc, { color: theme.textSecondary }]}>{action.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const ss = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  hero: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    overflow: 'hidden',
  },
  heroInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarGlow: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  listIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listText: {
    flex: 1,
  },
  listLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 1,
  },
  listDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
});

export default SmartSuggest;
