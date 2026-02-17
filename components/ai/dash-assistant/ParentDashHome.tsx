/**
 * ParentDashHome — #NEXT-GEN empty-state landing for parent Dash Chat.
 *
 * Purpose-built for parents:
 *   - Active child header with avatar + grade
 *   - Child-switcher (when multiple children)
 *   - Homework-focused quick actions
 *   - Snap-homework flow CTA
 *   - Subject-specific prompts based on child's grade
 *   - SA-flavored personality
 *
 * ≤400 lines (excl. StyleSheet).
 *
 * @module ParentDashHome
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParentChild {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  grade?: string | null;
  date_of_birth?: string | null;
  avatar_url?: string | null;
  class_name?: string | null;
}

interface ParentDashHomeProps {
  children: ParentChild[];
  activeChild: ParentChild | null;
  onSelectChild: (childId: string) => void;
  onSendMessage: (text: string) => void;
  onOpenScanner?: () => void;
  lastConversationId?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getChildAge(dob?: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age;
}

function getInitials(child: ParentChild): string {
  const first = (child.first_name || '')[0] || '';
  const last = (child.last_name || '')[0] || '';
  return (first + last).toUpperCase() || '🧒';
}

function getGradeLabel(grade?: string | null): string {
  if (!grade) return '';
  const g = grade.trim().toLowerCase();
  if (g.startsWith('grade')) return grade.trim();
  if (g === 'r') return 'Grade R';
  const num = g.match(/\d+/);
  return num ? `Grade ${num[0]}` : grade.trim();
}

// ---------------------------------------------------------------------------
// Subject quick-starts based on grade level
// ---------------------------------------------------------------------------

function getSubjectActions(grade?: string | null) {
  const g = (grade || '').toLowerCase();
  const num = parseInt(g.replace(/[^0-9]/g, ''), 10);

  // Preschool / Grade R
  if (g.includes('r') || isNaN(num) || num === 0) {
    return [
      { icon: 'color-palette-outline', label: 'Colours & Shapes', subject: 'colours and shapes' },
      { icon: 'musical-notes-outline', label: 'Rhymes & Songs', subject: 'nursery rhymes and early literacy' },
      { icon: 'calculator-outline', label: 'Counting', subject: 'counting and numbers 1-20' },
      { icon: 'book-outline', label: 'Story Time', subject: 'a simple story with comprehension questions' },
    ] as const;
  }

  // Foundation phase (1-3)
  if (num <= 3) {
    return [
      { icon: 'calculator-outline', label: 'Maths', subject: 'maths' },
      { icon: 'book-outline', label: 'Reading', subject: 'reading and comprehension' },
      { icon: 'language-outline', label: 'Phonics', subject: 'phonics and letter sounds' },
      { icon: 'earth-outline', label: 'Life Skills', subject: 'life skills' },
    ] as const;
  }

  // Intermediate phase (4-6)
  if (num <= 6) {
    return [
      { icon: 'calculator-outline', label: 'Maths', subject: 'mathematics' },
      { icon: 'book-outline', label: 'English', subject: 'English language' },
      { icon: 'flask-outline', label: 'Natural Science', subject: 'natural science and technology' },
      { icon: 'people-outline', label: 'Social Science', subject: 'social sciences' },
    ] as const;
  }

  // Senior (7-9)
  if (num <= 9) {
    return [
      { icon: 'calculator-outline', label: 'Maths', subject: 'mathematics' },
      { icon: 'flask-outline', label: 'Science', subject: 'natural sciences' },
      { icon: 'book-outline', label: 'English', subject: 'English' },
      { icon: 'globe-outline', label: 'Geography', subject: 'geography' },
    ] as const;
  }

  // FET (10-12)
  return [
    { icon: 'calculator-outline', label: 'Maths', subject: 'mathematics' },
    { icon: 'flask-outline', label: 'Physical Science', subject: 'physical science' },
    { icon: 'business-outline', label: 'Accounting', subject: 'accounting' },
    { icon: 'book-outline', label: 'English', subject: 'English' },
  ] as const;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ParentDashHome: React.FC<ParentDashHomeProps> = ({
  children: childrenList,
  activeChild,
  onSelectChild,
  onSendMessage,
  onOpenScanner,
  lastConversationId,
}) => {
  const { theme } = useTheme();
  const hasChildren = childrenList.length > 0;
  const hasMultipleChildren = childrenList.length > 1;
  const childName = activeChild?.first_name || 'your child';
  const childAge = getChildAge(activeChild?.date_of_birth);
  const gradeLabel = getGradeLabel(activeChild?.grade);
  const subjectActions = useMemo(
    () => getSubjectActions(hasChildren ? activeChild?.grade : null),
    [activeChild?.grade, hasChildren]
  );

  const sendWithContext = useCallback(
    (prompt: string) => {
      const prefix = activeChild
        ? `I'm helping ${childName}${gradeLabel ? ` (${gradeLabel})` : ''}. `
        : '';
      onSendMessage(`${prefix}${prompt}`);
    },
    [activeChild, childName, gradeLabel, onSendMessage]
  );

  return (
    <ScrollView
      contentContainerStyle={s.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ---- Hero card ---- */}
      <LinearGradient
        colors={['#0d1b2a', '#1b2838', '#0d1b2a']}
        style={[s.heroCard, { borderColor: theme.border }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Active child header */}
        <View style={s.childHeader}>
          {activeChild?.avatar_url ? (
            <Image source={{ uri: activeChild.avatar_url }} style={s.avatar} />
          ) : (
            <View style={[s.avatarFallback, { backgroundColor: theme.primary + '33' }]}>
              <Text style={[s.avatarInitials, { color: theme.primary }]}>
                {activeChild ? getInitials(activeChild) : '👋'}
              </Text>
            </View>
          )}
          <View style={s.childInfo}>
            <Text style={[s.heroTitle, { color: '#fff' }]} numberOfLines={1}>
              {activeChild ? `Helping ${childName}` : 'Hey there, parent! 🎓'}
            </Text>
            <Text style={[s.heroSubtitle, { color: 'rgba(255,255,255,0.65)' }]}>
              {gradeLabel
                ? `${gradeLabel}${childAge ? ` · ${childAge} years` : ''}`
                : hasChildren
                  ? 'Homework help, practice, and learning together'
                  : 'Your AI-powered family tutor is ready'}
            </Text>
          </View>
        </View>

        {/* Link child nudge (no children linked yet) */}
        {!hasChildren && (
          <TouchableOpacity
            style={[s.linkChildBanner, { borderColor: theme.primary + '44' }]}
            onPress={() => router.push('/screens/parent-settings' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="person-add-outline" size={18} color={theme.primary} />
            <Text style={[s.linkChildText, { color: 'rgba(255,255,255,0.85)' }]}>
              Link your child's profile for personalised help
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.primary} />
          </TouchableOpacity>
        )}

        {/* Child switcher (if multiple) */}
        {hasMultipleChildren && (
          <View style={s.childSwitcher}>
            {childrenList.map((child) => {
              const isActive = child.id === activeChild?.id;
              return (
                <TouchableOpacity
                  key={child.id}
                  style={[
                    s.childChip,
                    {
                      backgroundColor: isActive ? theme.primary : 'rgba(255,255,255,0.08)',
                      borderColor: isActive ? theme.primary : 'rgba(255,255,255,0.15)',
                    },
                  ]}
                  onPress={() => onSelectChild(child.id)}
                >
                  <Text
                    style={[
                      s.childChipText,
                      { color: isActive ? '#fff' : 'rgba(255,255,255,0.7)' },
                    ]}
                    numberOfLines={1}
                  >
                    {child.first_name || 'Child'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Primary CTAs */}
        <View style={s.heroCTAs}>
          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: theme.primary }]}
            onPress={() =>
              sendWithContext(
                'Please help with homework now. Use the child context, explain step-by-step, and finish with one quick check question.'
              )
            }
          >
            <Ionicons name="school-outline" size={18} color="#fff" />
            <Text style={s.primaryBtnText}>Homework Help</Text>
          </TouchableOpacity>
          {onOpenScanner && (
            <TouchableOpacity
              style={[s.secondaryBtn, { borderColor: 'rgba(255,255,255,0.2)' }]}
              onPress={onOpenScanner}
            >
              <Ionicons name="camera-outline" size={18} color="#fff" />
              <Text style={s.secondaryBtnText}>Snap Homework</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* ---- Subject quick-starts ---- */}
      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>
          {gradeLabel ? `${gradeLabel} subjects` : hasChildren ? 'Quick starts' : 'Explore by subject'}
        </Text>
        <View style={s.subjectGrid}>
          {subjectActions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={[s.subjectCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              activeOpacity={0.7}
              onPress={() =>
                sendWithContext(
                  `Help me practice ${action.subject}. Start with one diagnostic question to find ${childName}'s level.`
                )
              }
            >
              <Ionicons
                name={action.icon as any}
                size={22}
                color={theme.primary}
              />
              <Text style={[s.subjectLabel, { color: theme.text }]} numberOfLines={1}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ---- More actions ---- */}
      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>More ways Dash can help</Text>

        <TouchableOpacity
          style={[s.actionRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() =>
            sendWithContext(
              `Create a fun 5-question mixed-subject quiz for ${gradeLabel || 'this grade'}. Start immediately, keep score, and include answers at the end.`
            )
          }
        >
          <View style={[s.actionIcon, { backgroundColor: '#f59e0b20' }]}>
            <Ionicons name="trophy-outline" size={20} color="#f59e0b" />
          </View>
          <View style={s.actionContent}>
            <Text style={[s.actionTitle, { color: theme.text }]}>Quiz Time</Text>
            <Text style={[s.actionDesc, { color: theme.textSecondary }]}>
              5-question quiz in any subject
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.actionRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() =>
            sendWithContext(
              `Explain today’s most likely tricky concept for ${childName} in simple language, with one example and one mini practice question.`
            )
          }
        >
          <View style={[s.actionIcon, { backgroundColor: '#8b5cf620' }]}>
            <Ionicons name="bulb-outline" size={20} color="#8b5cf6" />
          </View>
          <View style={s.actionContent}>
            <Text style={[s.actionTitle, { color: theme.text }]}>Explain It Simply</Text>
            <Text style={[s.actionDesc, { color: theme.textSecondary }]}>
              Clear, step-by-step explanation
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.actionRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() =>
            sendWithContext(
              'Suggest fun learning activities I can do at home with my child this weekend.'
            )
          }
        >
          <View style={[s.actionIcon, { backgroundColor: '#22c55e20' }]}>
            <Ionicons name="game-controller-outline" size={20} color="#22c55e" />
          </View>
          <View style={s.actionContent}>
            <Text style={[s.actionTitle, { color: theme.text }]}>Home Activities</Text>
            <Text style={[s.actionDesc, { color: theme.textSecondary }]}>
              Fun weekend learning ideas
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ---- Resume & Tutor mode links ---- */}
      {lastConversationId && (
        <TouchableOpacity
          style={[s.resumeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() =>
            router.push({
              pathname: '/screens/dash-assistant',
              params: { conversationId: lastConversationId },
            })
          }
        >
          <Ionicons name="time-outline" size={18} color={theme.primary} />
          <Text style={[s.resumeText, { color: theme.text }]}>
            Continue last conversation
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 16,
  },
  // Hero
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  childHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '700',
  },
  childInfo: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  heroSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  // Link child banner (no children)
  linkChildBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  linkChildText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  // Child switcher
  childSwitcher: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  childChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  childChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // CTAs
  heroCTAs: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  // Sections
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Subject grid
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  subjectCard: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  subjectLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  // Action rows
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  // Resume card
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  resumeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ParentDashHome;
