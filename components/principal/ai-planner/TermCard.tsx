// Term Card Component for AI Year Planner
// Displays individual term with collapsible details, date ranges, and inline editing

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { GeneratedTerm, WeeklyTheme, PlannedExcursion, PlannedMeeting } from './types';
import { createStyles, MEETING_TYPE_COLORS } from './TermCard.styles';

interface TermCardProps {
  term: GeneratedTerm;
  isExpanded: boolean;
  isEditing: boolean;
  onToggleExpand: () => void;
  onUpdateTerm: (updater: (term: GeneratedTerm) => GeneratedTerm) => void;
}

const MEETING_TYPES = ['staff', 'parent', 'curriculum', 'safety', 'budget', 'training', 'other'];

function addDaysToDate(dateStr: string, days: number): Date {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatShortDate(date: Date): string {
  const day = date.getUTCDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[date.getUTCMonth()]}`;
}

function computeWeekDateRange(termStartDate: string, weekNumber: number): string {
  const weekStart = addDaysToDate(termStartDate, (weekNumber - 1) * 7);
  const weekEnd = addDaysToDate(termStartDate, (weekNumber - 1) * 7 + 4);
  return `${formatShortDate(weekStart)} – ${formatShortDate(weekEnd)}`;
}

export function TermCard({ term, isExpanded, isEditing, onToggleExpand, onUpdateTerm }: TermCardProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [showAllThemes, setShowAllThemes] = useState(false);
  const visibleThemes = showAllThemes ? term.weeklyThemes : term.weeklyThemes.slice(0, 5);

  const weekDateRanges = useMemo(() => {
    const map = new Map<number, string>();
    term.weeklyThemes.forEach((wt) => {
      map.set(wt.week, computeWeekDateRange(term.startDate, wt.week));
    });
    return map;
  }, [term.startDate, term.weeklyThemes]);

  const updateTheme = (week: number, patch: Partial<WeeklyTheme>) => {
    onUpdateTerm((t) => ({
      ...t,
      weeklyThemes: t.weeklyThemes.map((wt) => (wt.week === week ? { ...wt, ...patch } : wt)),
    }));
  };

  const addTheme = () => {
    onUpdateTerm((t) => ({
      ...t,
      weeklyThemes: [
        ...t.weeklyThemes,
        {
          week: t.weeklyThemes.length > 0 ? Math.max(...t.weeklyThemes.map((w) => w.week)) + 1 : 1,
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
      weeklyThemes: t.weeklyThemes.filter((wt) => wt.week !== week).map((wt, i) => ({ ...wt, week: i + 1 })),
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
      meetings: [...t.meetings, { title: 'New Meeting', type: 'staff', suggestedDate: t.startDate, agenda: [] }],
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
        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={24} color={theme.textSecondary} />
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
            {visibleThemes.map((week, idx) => (
              <View key={week.week} style={[styles.weekItem, idx % 2 === 1 && styles.weekItemAlt]}>
                <View style={styles.weekNumber}>
                  <Text style={styles.weekNumberText}>W{week.week}</Text>
                </View>
                <View style={styles.weekContent}>
                  <Text style={styles.weekDateRange}>
                    {weekDateRanges.get(week.week) || ''}
                  </Text>
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
                  <View style={styles.excursionContent}>
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
                    <View style={[styles.dateRow, { marginTop: 4 }]}>
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
                  </View>
                ) : (
                  <>
                    <View style={styles.excursionIconContainer}>
                      <Ionicons name="location-outline" size={18} color="#10B981" />
                    </View>
                    <View style={styles.excursionContent}>
                      <Text style={styles.excursionTitle}>{exc.title}</Text>
                      <Text style={styles.excursionDetail}>{exc.destination}</Text>
                      <View style={styles.excursionMeta}>
                        {exc.suggestedDate ? (
                          <View style={styles.dateBadge}>
                            <Text style={styles.dateBadgeText}>{exc.suggestedDate}</Text>
                          </View>
                        ) : null}
                        <View style={styles.costTag}>
                          <Text style={styles.costTagText}>{exc.estimatedCost}</Text>
                        </View>
                      </View>
                    </View>
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
                    <View style={styles.meetingHeader}>
                      <Text style={styles.meetingTitle}>{meeting.title}</Text>
                      <View
                        style={[
                          styles.meetingTypeBadge,
                          { backgroundColor: MEETING_TYPE_COLORS[meeting.type] || MEETING_TYPE_COLORS.other },
                        ]}
                      >
                        <Text style={styles.meetingTypeBadgeText}>{meeting.type}</Text>
                      </View>
                    </View>
                    {meeting.suggestedDate && (
                      <Text style={styles.meetingDate}>{meeting.suggestedDate}</Text>
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
            {term.specialEvents.map((event, idx) =>
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
                <View key={idx} style={styles.eventItem}>
                  <Ionicons name="star" size={16} color="#F59E0B" />
                  <Text style={styles.eventText}>{event}</Text>
                </View>
              )
            )}
          </View>
        </View>
      )}
    </View>
  );
}
