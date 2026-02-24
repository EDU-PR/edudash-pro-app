// Term Card Component for AI Year Planner
// Displays individual term with collapsible details and inline editing

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { GeneratedTerm, WeeklyTheme, PlannedExcursion, PlannedMeeting } from './types';

interface TermCardProps {
  term: GeneratedTerm;
  isExpanded: boolean;
  isEditing: boolean;
  onToggleExpand: () => void;
  onUpdateTerm: (updater: (term: GeneratedTerm) => GeneratedTerm) => void;
}

const MEETING_TYPES = ['staff', 'parent', 'curriculum', 'safety', 'budget', 'training', 'other'];

export function TermCard({ term, isExpanded, isEditing, onToggleExpand, onUpdateTerm }: TermCardProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [showAllThemes, setShowAllThemes] = useState(false);
  const visibleThemes = showAllThemes ? term.weeklyThemes : term.weeklyThemes.slice(0, 5);

  const updateTheme = (week: number, patch: Partial<WeeklyTheme>) => {
    onUpdateTerm((t) => ({
      ...t,
      weeklyThemes: t.weeklyThemes.map((wt) =>
        wt.week === week ? { ...wt, ...patch } : wt
      ),
    }));
  };

  const addTheme = () => {
    onUpdateTerm((t) => ({
      ...t,
      weeklyThemes: [
        ...t.weeklyThemes,
        {
          week: (t.weeklyThemes.length > 0 ? Math.max(...t.weeklyThemes.map((w) => w.week)) + 1 : 1),
          theme: 'New Theme',
          description: '',
          activities: [],
        },
      ],
    }));
  };

  const removeTheme = (week: number) => {
    onUpdateTerm((t) => ({
      ...t,
      weeklyThemes: t.weeklyThemes
        .filter((wt) => wt.week !== week)
        .map((wt, i) => ({ ...wt, week: i + 1 })),
    }));
  };

  const updateExcursion = (idx: number, patch: Partial<PlannedExcursion>) => {
    onUpdateTerm((t) => ({
      ...t,
      excursions: t.excursions.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    }));
  };

  const addExcursion = () => {
    onUpdateTerm((t) => ({
      ...t,
      excursions: [
        ...t.excursions,
        { title: 'New Excursion', destination: '', suggestedDate: t.startDate, learningObjectives: [], estimatedCost: 'TBD' },
      ],
    }));
  };

  const removeExcursion = (idx: number) => {
    onUpdateTerm((t) => ({ ...t, excursions: t.excursions.filter((_, i) => i !== idx) }));
  };

  const updateMeeting = (idx: number, patch: Partial<PlannedMeeting>) => {
    onUpdateTerm((t) => ({
      ...t,
      meetings: t.meetings.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    }));
  };

  const addMeeting = () => {
    onUpdateTerm((t) => ({
      ...t,
      meetings: [
        ...t.meetings,
        { title: 'New Meeting', type: 'staff', suggestedDate: t.startDate, agenda: [] },
      ],
    }));
  };

  const removeMeeting = (idx: number) => {
    onUpdateTerm((t) => ({ ...t, meetings: t.meetings.filter((_, i) => i !== idx) }));
  };

  const updateSpecialEvent = (idx: number, value: string) => {
    onUpdateTerm((t) => ({
      ...t,
      specialEvents: t.specialEvents.map((e, i) => (i === idx ? value : e)),
    }));
  };

  const addSpecialEvent = () => {
    onUpdateTerm((t) => ({ ...t, specialEvents: [...t.specialEvents, 'New Event'] }));
  };

  const removeSpecialEvent = (idx: number) => {
    onUpdateTerm((t) => ({ ...t, specialEvents: t.specialEvents.filter((_, i) => i !== idx) }));
  };

  return (
    <View style={styles.termCard}>
      <TouchableOpacity style={styles.termHeader} onPress={onToggleExpand}>
        <View style={styles.termHeaderLeft}>
          <View style={[styles.termBadge, { backgroundColor: theme.primary }]}>
            <Text style={styles.termBadgeText}>{term.termNumber}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {isEditing ? (
              <TextInput
                style={styles.inlineInput}
                value={term.name}
                onChangeText={(v) => onUpdateTerm((t) => ({ ...t, name: v }))}
                placeholder="Term name"
                placeholderTextColor={theme.textSecondary}
                onPress={(e) => e.stopPropagation?.()}
              />
            ) : (
              <Text style={styles.termName}>{term.name}</Text>
            )}
            {isEditing ? (
              <View style={styles.dateRow}>
                <TextInput
                  style={[styles.inlineInput, { flex: 1 }]}
                  value={term.startDate}
                  onChangeText={(v) => onUpdateTerm((t) => ({ ...t, startDate: v }))}
                  placeholder="Start YYYY-MM-DD"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                />
                <Text style={{ color: theme.textSecondary, marginHorizontal: 4 }}>→</Text>
                <TextInput
                  style={[styles.inlineInput, { flex: 1 }]}
                  value={term.endDate}
                  onChangeText={(v) => onUpdateTerm((t) => ({ ...t, endDate: v }))}
                  placeholder="End YYYY-MM-DD"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                />
              </View>
            ) : (
              <Text style={styles.termDates}>
                {new Date(term.startDate).toLocaleDateString()} – {new Date(term.endDate).toLocaleDateString()}
              </Text>
            )}
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
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="calendar-outline" size={16} color={theme.primary} /> Weekly Themes ({term.weeklyThemes.length})
              </Text>
              {isEditing && (
                <TouchableOpacity style={styles.addBtn} onPress={addTheme}>
                  <Ionicons name="add" size={16} color={theme.primary} />
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
            {visibleThemes.map((week) => (
              <View key={week.week} style={styles.weekItem}>
                <View style={styles.weekNumber}>
                  <Text style={styles.weekNumberText}>W{week.week}</Text>
                </View>
                <View style={styles.weekContent}>
                  {isEditing ? (
                    <>
                      <TextInput
                        style={styles.inlineInput}
                        value={week.theme}
                        onChangeText={(v) => updateTheme(week.week, { theme: v })}
                        placeholder="Theme title"
                        placeholderTextColor={theme.textSecondary}
                      />
                      <TextInput
                        style={[styles.inlineInput, { marginTop: 4 }]}
                        value={week.description}
                        onChangeText={(v) => updateTheme(week.week, { description: v })}
                        placeholder="Description"
                        placeholderTextColor={theme.textSecondary}
                        multiline
                      />
                      <TextInput
                        style={[styles.inlineInput, { marginTop: 4, fontSize: 12 }]}
                        value={(week.activities || []).join(', ')}
                        onChangeText={(v) =>
                          updateTheme(week.week, {
                            activities: v.split(',').map((s) => s.trim()).filter(Boolean),
                          })
                        }
                        placeholder="Activities (comma-separated)"
                        placeholderTextColor={theme.textSecondary}
                        multiline
                      />
                    </>
                  ) : (
                    <>
                      <Text style={styles.weekTheme}>{week.theme}</Text>
                      <Text style={styles.weekDescription}>{week.description}</Text>
                      {(week.activities || []).length > 0 && (
                        <Text style={styles.weekActivities}>
                          {week.activities.slice(0, 3).join(' · ')}
                        </Text>
                      )}
                    </>
                  )}
                </View>
                {isEditing && (
                  <TouchableOpacity onPress={() => removeTheme(week.week)} style={{ padding: 4 }}>
                    <Ionicons name="trash-outline" size={16} color={theme.error || '#ef4444'} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {term.weeklyThemes.length > 5 && (
              <TouchableOpacity onPress={() => setShowAllThemes((prev) => !prev)}>
                <Text style={styles.moreItems}>
                  {showAllThemes ? 'Show less' : `+${term.weeklyThemes.length - 5} more themes`}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Excursions */}
          <View style={styles.termSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="bus-outline" size={16} color="#10B981" /> Excursions ({term.excursions.length})
              </Text>
              {isEditing && (
                <TouchableOpacity style={styles.addBtn} onPress={addExcursion}>
                  <Ionicons name="add" size={16} color={theme.primary} />
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
            {term.excursions.length === 0 && !isEditing && (
              <Text style={styles.emptyHint}>No excursions planned.</Text>
            )}
            {term.excursions.map((exc, idx) => (
              <View key={idx} style={styles.excursionItem}>
                {isEditing ? (
                  <>
                    <View style={styles.editRowWithDelete}>
                      <TextInput
                        style={[styles.inlineInput, { flex: 1 }]}
                        value={exc.title}
                        onChangeText={(v) => updateExcursion(idx, { title: v })}
                        placeholder="Title"
                        placeholderTextColor={theme.textSecondary}
                      />
                      <TouchableOpacity onPress={() => removeExcursion(idx)} style={{ padding: 4 }}>
                        <Ionicons name="trash-outline" size={16} color={theme.error || '#ef4444'} />
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[styles.inlineInput, { marginTop: 4 }]}
                      value={exc.destination}
                      onChangeText={(v) => updateExcursion(idx, { destination: v })}
                      placeholder="Destination"
                      placeholderTextColor={theme.textSecondary}
                    />
                    <View style={styles.dateRow}>
                      <TextInput
                        style={[styles.inlineInput, { flex: 1 }]}
                        value={exc.suggestedDate}
                        onChangeText={(v) => updateExcursion(idx, { suggestedDate: v })}
                        placeholder="Date YYYY-MM-DD"
                        placeholderTextColor={theme.textSecondary}
                        autoCapitalize="none"
                      />
                      <TextInput
                        style={[styles.inlineInput, { flex: 1, marginLeft: 8 }]}
                        value={exc.estimatedCost}
                        onChangeText={(v) => updateExcursion(idx, { estimatedCost: v })}
                        placeholder="Cost e.g. R200"
                        placeholderTextColor={theme.textSecondary}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.excursionTitle}>{exc.title}</Text>
                    <Text style={styles.excursionDetail}>{exc.destination}</Text>
                    {exc.suggestedDate && (
                      <Text style={styles.excursionDetail}>{exc.suggestedDate}</Text>
                    )}
                    <Text style={styles.excursionCost}>{exc.estimatedCost}</Text>
                  </>
                )}
              </View>
            ))}
          </View>

          {/* Meetings */}
          <View style={styles.termSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="people-outline" size={16} color="#8B5CF6" /> Meetings ({term.meetings.length})
              </Text>
              {isEditing && (
                <TouchableOpacity style={styles.addBtn} onPress={addMeeting}>
                  <Ionicons name="add" size={16} color={theme.primary} />
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
            {term.meetings.length === 0 && !isEditing && (
              <Text style={styles.emptyHint}>No meetings planned.</Text>
            )}
            {term.meetings.map((meeting, idx) => (
              <View key={idx} style={styles.meetingItem}>
                {isEditing ? (
                  <>
                    <View style={styles.editRowWithDelete}>
                      <TextInput
                        style={[styles.inlineInput, { flex: 1 }]}
                        value={meeting.title}
                        onChangeText={(v) => updateMeeting(idx, { title: v })}
                        placeholder="Meeting title"
                        placeholderTextColor={theme.textSecondary}
                      />
                      <TouchableOpacity onPress={() => removeMeeting(idx)} style={{ padding: 4 }}>
                        <Ionicons name="trash-outline" size={16} color={theme.error || '#ef4444'} />
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.dateRow, { flexWrap: 'wrap', marginTop: 4 }]}>
                      {MEETING_TYPES.map((mt) => (
                        <TouchableOpacity
                          key={mt}
                          style={[styles.typeChip, meeting.type === mt && styles.typeChipActive]}
                          onPress={() => updateMeeting(idx, { type: mt })}
                        >
                          <Text style={[styles.typeChipText, meeting.type === mt && styles.typeChipTextActive]}>
                            {mt}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={[styles.inlineInput, { marginTop: 4 }]}
                      value={meeting.suggestedDate}
                      onChangeText={(v) => updateMeeting(idx, { suggestedDate: v })}
                      placeholder="Date YYYY-MM-DD"
                      placeholderTextColor={theme.textSecondary}
                      autoCapitalize="none"
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.meetingTitle}>{meeting.title}</Text>
                    <Text style={styles.meetingType}>{meeting.type}</Text>
                    {meeting.suggestedDate && (
                      <Text style={styles.meetingType}>{meeting.suggestedDate}</Text>
                    )}
                  </>
                )}
              </View>
            ))}
          </View>

          {/* Special Events */}
          <View style={styles.termSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="star-outline" size={16} color="#F59E0B" /> Special Events ({term.specialEvents.length})
              </Text>
              {isEditing && (
                <TouchableOpacity style={styles.addBtn} onPress={addSpecialEvent}>
                  <Ionicons name="add" size={16} color={theme.primary} />
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
            {term.specialEvents.length === 0 && !isEditing && (
              <Text style={styles.emptyHint}>No special events planned.</Text>
            )}
            {term.specialEvents.map((event, idx) => (
              isEditing ? (
                <View key={idx} style={styles.editRowWithDelete}>
                  <TextInput
                    style={[styles.inlineInput, { flex: 1 }]}
                    value={event}
                    onChangeText={(v) => updateSpecialEvent(idx, v)}
                    placeholder="Event name"
                    placeholderTextColor={theme.textSecondary}
                  />
                  <TouchableOpacity onPress={() => removeSpecialEvent(idx)} style={{ padding: 4 }}>
                    <Ionicons name="trash-outline" size={16} color={theme.error || '#ef4444'} />
                  </TouchableOpacity>
                </View>
              ) : (
                <Text key={idx} style={styles.eventItem}>• {event}</Text>
              )
            ))}
          </View>
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
      alignItems: 'flex-start',
      gap: 12,
      flex: 1,
    },
    termBadge: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
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
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    inlineInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 14,
      color: theme.text,
      backgroundColor: theme.background,
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
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    addBtnText: {
      fontSize: 13,
      color: theme.primary,
      fontWeight: '600',
    },
    editRowWithDelete: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    weekItem: {
      flexDirection: 'row',
      marginBottom: 10,
      alignItems: 'flex-start',
    },
    weekNumber: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      flexShrink: 0,
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
    weekActivities: {
      fontSize: 12,
      color: theme.primary,
      marginTop: 2,
    },
    moreItems: {
      fontSize: 13,
      color: theme.primary,
      fontStyle: 'italic',
      marginTop: 4,
    },
    emptyHint: {
      fontSize: 13,
      color: theme.textSecondary,
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
    typeChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      marginRight: 6,
      marginBottom: 4,
    },
    typeChipActive: {
      borderColor: theme.primary,
      backgroundColor: `${theme.primary}22`,
    },
    typeChipText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    typeChipTextActive: {
      color: theme.primary,
      fontWeight: '600',
    },
    eventItem: {
      fontSize: 14,
      color: theme.text,
      marginBottom: 6,
    },
  });
