// Generated Year Plan View Component
// Displays the AI-generated year plan overview with inline editing

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { GeneratedYearPlan, GeneratedTerm, YearPlanMonthlyBucket } from './types';
import { TermCard } from './TermCard';
import { PlanInsightsPanel } from './PlanInsightsPanel';
import { createStyles, MONTH_COLORS } from './GeneratedPlanView.styles';

import EduDashSpinner from '@/components/ui/EduDashSpinner';

interface GeneratedPlanViewProps {
  plan: GeneratedYearPlan;
  expandedTerm: number | null;
  isSaving: boolean;
  onToggleExpandTerm: (termNumber: number | null) => void;
  onSave: () => void;
  onRegenerate: () => void;
  onUpdatePlan: (updater: (plan: GeneratedYearPlan) => GeneratedYearPlan) => void;
  onShareTeachers?: () => void;
  onShareParents?: () => void;
  onExportPdf?: () => void;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const BUCKET_ORDER: YearPlanMonthlyBucket[] = [
  'holidays_closures',
  'meetings_admin',
  'excursions_extras',
  'donations_fundraisers',
];
const BUCKET_LABELS: Record<YearPlanMonthlyBucket, string> = {
  holidays_closures: 'Holidays & Closures',
  meetings_admin: 'Meetings & Admin',
  excursions_extras: 'Excursions & Extras',
  donations_fundraisers: 'Donations & Fundraisers',
};

type ViewTab = 'monthly' | 'terms' | 'insights';

function isHolidayEntry(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('holiday') || lower.includes('public') || lower.includes('day off');
}

function isFundraiserEntry(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('fundrais') || lower.includes('raffle') || lower.includes('sale') || lower.includes('market');
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getWeeklyThemesForMonth(
  plan: GeneratedYearPlan,
  monthIndex: number,
): Array<{ termNumber: number; week: number; theme: string }> {
  const result: Array<{ termNumber: number; week: number; theme: string }> = [];
  const year = plan.academicYear;
  const monthStart = `${year}-${String(monthIndex).padStart(2, '0')}-01`;
  const monthEnd = new Date(year, monthIndex, 0);
  const monthEndStr = monthEnd.toISOString().slice(0, 10);

  plan.terms.forEach((term) => {
    const termStart = term.startDate;
    term.weeklyThemes.forEach((wt) => {
      const weekStart = addDays(termStart, (wt.week - 1) * 7);
      if (weekStart >= monthStart && weekStart <= monthEndStr) {
        result.push({ termNumber: term.termNumber, week: wt.week, theme: wt.theme });
      }
    });
  });

  return result.sort(
    (a, b) =>
      (a.termNumber - b.termNumber) * 100 + (a.week - b.week),
  );
}

export function GeneratedPlanView({
  plan,
  expandedTerm,
  isSaving,
  onToggleExpandTerm,
  onSave,
  onRegenerate,
  onUpdatePlan,
  onShareTeachers,
  onShareParents,
  onExportPdf,
}: GeneratedPlanViewProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets.bottom);
  const [activeTab, setActiveTab] = useState<ViewTab>('monthly');
  const [isEditing, setIsEditing] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);

  const totalWeeks = useMemo(
    () => plan.terms.reduce((acc, t) => acc + t.weeklyThemes.length, 0),
    [plan.terms]
  );
  const totalExcursions = useMemo(
    () => plan.terms.reduce((acc, t) => acc + t.excursions.length, 0),
    [plan.terms]
  );
  const totalMeetings = useMemo(
    () => plan.terms.reduce((acc, t) => acc + t.meetings.length, 0),
    [plan.terms]
  );

  const monthlyByMonth = useMemo(() => {
    const map = new Map<number, Record<YearPlanMonthlyBucket, string[]>>();
    for (let i = 1; i <= 12; i += 1) {
      map.set(i, {
        holidays_closures: [],
        meetings_admin: [],
        excursions_extras: [],
        donations_fundraisers: [],
      });
    }
    (plan.monthlyEntries || []).forEach((entry) => {
      const month = Math.min(12, Math.max(1, Number(entry.monthIndex) || 1));
      const target = map.get(month);
      if (!target) return;
      const label = entry.details ? `${entry.title}: ${entry.details}` : entry.title;
      target[entry.bucket].push(label);
    });
    return map;
  }, [plan.monthlyEntries]);

  // Extract upcoming items for alerts: meetings, excursions, monthly entries with dates
  const upcomingAlerts = useMemo(() => {
    const alerts: { type: 'meeting' | 'excursion' | 'event'; title: string; date: string }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30Days = new Date(today);
    in30Days.setDate(in30Days.getDate() + 30);
    plan.terms.forEach((t) => {
      t.meetings.forEach((m) => {
        if (m.suggestedDate) {
          const d = new Date(m.suggestedDate);
          if (d >= today && d <= in30Days) {
            alerts.push({ type: 'meeting', title: m.title, date: m.suggestedDate });
          }
        }
      });
      t.excursions.forEach((e) => {
        if (e.suggestedDate) {
          const d = new Date(e.suggestedDate);
          if (d >= today && d <= in30Days) {
            alerts.push({ type: 'excursion', title: e.title, date: e.suggestedDate });
          }
        }
      });
    });
    (plan.monthlyEntries || []).forEach((entry) => {
      const dateStr = entry.startDate || `${plan.academicYear}-${String(entry.monthIndex).padStart(2, '0')}-01`;
      const d = new Date(dateStr);
      if (d >= today && d <= in30Days) {
        alerts.push({ type: 'event', title: entry.title, date: dateStr });
      }
    });
    return alerts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 8);
  }, [plan]);

  const updateTerm = (termNumber: number, updater: (term: GeneratedTerm) => GeneratedTerm) => {
    onUpdatePlan((p) => ({
      ...p,
      terms: p.terms.map((t) => (t.termNumber === termNumber ? updater(t) : t)),
    }));
  };

  return (
    <ScrollView style={styles.planContainer} contentContainerStyle={styles.planContent}>
      {/* Action Buttons Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.actionRow}
        contentContainerStyle={styles.actionRowContent}
      >
        <TouchableOpacity
          style={[styles.actionChip, styles.actionChipPrimary]}
          onPress={onSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <EduDashSpinner size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={16} color="#fff" />
              <Text style={[styles.actionChipText, styles.actionChipTextPrimary]}>Save to Database</Text>
            </>
          )}
        </TouchableOpacity>

        {onExportPdf && (
          <TouchableOpacity style={styles.actionChip} onPress={onExportPdf}>
            <Text style={styles.actionChipText}>📄 Export PDF</Text>
          </TouchableOpacity>
        )}
        {onShareTeachers && (
          <TouchableOpacity style={styles.actionChip} onPress={onShareTeachers}>
            <Text style={styles.actionChipText}>📤 Share with Teachers</Text>
          </TouchableOpacity>
        )}
        {onShareParents && (
          <TouchableOpacity style={styles.actionChip} onPress={onShareParents}>
            <Text style={styles.actionChipText}>👨‍👩‍👧 Share with Parents</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionChip} onPress={onRegenerate}>
          <Ionicons name="refresh" size={16} color={theme.text} />
          <Text style={styles.actionChipText}>Regenerate</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Plan Overview Header Card */}
      <View style={styles.overviewCard}>
        <View style={styles.overviewTitleRow}>
          <Text style={styles.overviewTitle}>Academic Year {plan.academicYear}</Text>
          <TouchableOpacity
            style={[styles.editToggleBtn, isEditing && styles.editToggleBtnActive]}
            onPress={() => setIsEditing((prev) => !prev)}
          >
            <Ionicons name={isEditing ? 'checkmark' : 'create-outline'} size={16} color={isEditing ? '#fff' : theme.primary} />
            <Text style={[styles.editToggleText, isEditing && styles.editToggleTextActive]}>
              {isEditing ? 'Done' : 'Edit Plan'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Vision Quote Box */}
        {isEditing ? (
          <TextInput
            style={styles.visionInput}
            value={plan.schoolVision}
            onChangeText={(v) => onUpdatePlan((p) => ({ ...p, schoolVision: v }))}
            placeholder="School vision statement"
            placeholderTextColor={theme.textSecondary}
            multiline
          />
        ) : (
          <View style={styles.visionQuoteBox}>
            <Text style={styles.visionQuoteText}>"{plan.schoolVision}"</Text>
          </View>
        )}

        {/* Year at a Glance pills */}
        <View style={styles.glanceRow}>
          <View style={styles.glancePill}>
            <Text style={styles.glancePillText}>{plan.terms.length} Terms</Text>
          </View>
          <View style={styles.glancePill}>
            <Text style={styles.glancePillText}>{totalWeeks} Weeks</Text>
          </View>
          <View style={styles.glancePill}>
            <Text style={styles.glancePillText}>{totalExcursions} Excursions</Text>
          </View>
          <View style={styles.glancePill}>
            <Text style={styles.glancePillText}>{totalMeetings} Meetings</Text>
          </View>
        </View>

        {/* Budget row */}
        <View style={styles.budgetRow}>
          <Ionicons name="wallet-outline" size={18} color={theme.textSecondary} />
          {isEditing ? (
            <TextInput
              style={styles.budgetInput}
              value={plan.budgetEstimate}
              onChangeText={(v) => onUpdatePlan((p) => ({ ...p, budgetEstimate: v }))}
              placeholder="e.g. R15,000"
              placeholderTextColor={theme.textSecondary}
            />
          ) : (
            <Text style={styles.budgetText}>Estimated Budget: {plan.budgetEstimate}</Text>
          )}
        </View>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabRow}>
        {(['monthly', 'terms', 'insights'] as ViewTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
              {tab === 'monthly' ? 'Monthly View' : tab === 'terms' ? 'Term View' : 'Insights'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Annual Goals */}
      <View style={styles.goalsCard}>
        <View style={styles.goalsTitleRow}>
          <Text style={styles.goalsTitle}>Annual Goals</Text>
          {isEditing && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => onUpdatePlan((p) => ({ ...p, annualGoals: [...p.annualGoals, 'New goal'] }))}
            >
              <Ionicons name="add" size={16} color={theme.primary} />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
        {plan.annualGoals.map((goal, idx) => (
          <View key={idx} style={styles.goalItem}>
            <View style={styles.goalNumberBadge}>
              <Text style={styles.goalNumberText}>{idx + 1}</Text>
            </View>
            {isEditing ? (
              <>
                <TextInput
                  style={[styles.goalInput, { flex: 1 }]}
                  value={goal}
                  onChangeText={(v) =>
                    onUpdatePlan((p) => ({
                      ...p,
                      annualGoals: p.annualGoals.map((g, i) => (i === idx ? v : g)),
                    }))
                  }
                  placeholder="Annual goal"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                />
                <TouchableOpacity
                  onPress={() =>
                    onUpdatePlan((p) => ({
                      ...p,
                      annualGoals: p.annualGoals.filter((_, i) => i !== idx),
                    }))
                  }
                  style={{ padding: 4 }}
                >
                  <Ionicons name="trash-outline" size={16} color={theme.error || '#ef4444'} />
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.goalText}>{goal}</Text>
            )}
          </View>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === 'monthly' && (
        <>
          {/* Upcoming Alerts */}
          {upcomingAlerts.length > 0 && (
            <View style={styles.alertsCard}>
              <Text style={styles.alertsTitle}>
                <Ionicons name="notifications-outline" size={18} color="#F59E0B" /> Coming Up
              </Text>
              {upcomingAlerts.map((a, i) => {
                const d = new Date(a.date);
                const days = Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                const icon = a.type === 'meeting' ? 'people' : a.type === 'excursion' ? 'bus' : 'calendar';
                const isLast = i === upcomingAlerts.length - 1;
                return (
                  <View key={i} style={[styles.alertRow, isLast && { borderBottomWidth: 0 }]}>
                    <View style={[styles.alertIcon, { backgroundColor: a.type === 'meeting' ? '#8B5CF620' : a.type === 'excursion' ? '#10B98120' : '#F59E0B20' }]}>
                      <Ionicons name={icon as any} size={14} color={a.type === 'meeting' ? '#8B5CF6' : a.type === 'excursion' ? '#10B981' : '#F59E0B'} />
                    </View>
                    <View style={styles.alertContent}>
                      <Text style={styles.alertTitle}>{a.title}</Text>
                      <Text style={styles.alertMeta}>
                        {a.date} · {days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `in ${days} days`}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <Text style={styles.termsHeader}>{plan.academicYear} · Tap a month to expand</Text>
          <View style={styles.monthlyGridCompact}>
            {Array.from({ length: 12 }, (_, idx) => {
              const month = idx + 1;
              const grouped = monthlyByMonth.get(month)!;
              const itemCount = BUCKET_ORDER.reduce((s, b) => s + grouped[b].length, 0);
              const isExpanded = expandedMonth === month;
              return (
                <View key={month} style={styles.monthTileWrapper}>
                  <TouchableOpacity
                    style={[styles.monthTile, isExpanded && styles.monthTileExpanded]}
                    onPress={() => setExpandedMonth(isExpanded ? null : month)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.monthTileHeader, { backgroundColor: MONTH_COLORS[idx] }]}>
                      <Text style={styles.monthTileTitle}>{MONTH_NAMES[idx].slice(0, 3)}</Text>
                      {itemCount > 0 && (
                        <View style={styles.monthTileBadge}>
                          <Text style={styles.monthTileBadgeText}>{itemCount}</Text>
                        </View>
                      )}
                    </View>
                    {isExpanded && (
                      <View style={styles.monthTileBody}>
                        {BUCKET_ORDER.map((bucket, bIdx) => {
                          const items = grouped[bucket];
                          if (items.length === 0) return null;
                          return (
                            <View key={bucket} style={styles.monthBucket}>
                              <Text style={styles.monthBucketLabel}>{BUCKET_LABELS[bucket]}</Text>
                              {items.map((item, itemIndex) => {
                                const holiday = bucket === 'holidays_closures' && isHolidayEntry(item);
                                const fundraiser = bucket === 'donations_fundraisers' && isFundraiserEntry(item);
                                return (
                                  <Text
                                    key={`${bucket}-${itemIndex}`}
                                    style={holiday ? styles.monthItemHoliday : fundraiser ? styles.monthItemFundraiser : styles.monthItem}
                                    numberOfLines={3}
                                  >
                                    {holiday ? '🇿🇦 ' : fundraiser ? '💡 ' : '• '}{item}
                                  </Text>
                                );
                              })}
                            </View>
                          );
                        })}
                        {(() => {
                          const weeklyThemes = getWeeklyThemesForMonth(plan, month);
                          if (weeklyThemes.length === 0) return null;
                          return (
                            <View key="weekly-themes" style={styles.monthBucket}>
                              <Text style={styles.monthBucketLabel}>Weekly themes</Text>
                              {weeklyThemes.map((wt, idx) => (
                                <Text
                                  key={`wt-${idx}`}
                                  style={styles.monthItem}
                                  numberOfLines={2}
                                >
                                  T{wt.termNumber} W{wt.week}: {wt.theme}
                                </Text>
                              ))}
                            </View>
                          );
                        })()}
                      </View>
                    )}
                    {!isExpanded && (
                      <View style={styles.monthTileChevron}>
                        <Ionicons name="chevron-down" size={14} color={theme.textSecondary} />
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* Operational Highlights */}
          <View style={styles.goalsCard}>
            <Text style={styles.goalsTitle}>Operational Highlights</Text>
            {(plan.operationalHighlights || []).slice(0, 6).map((highlight, idx) => (
              <View key={idx} style={styles.goalItem}>
                <Ionicons name="flash" size={18} color="#8B5CF6" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.goalText}>{highlight.title}</Text>
                  <Text style={styles.monthItem}>{highlight.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {activeTab === 'terms' && (
        <>
          <Text style={styles.termsHeader}>Term Details</Text>
          {plan.terms.map((term) => (
            <TermCard
              key={term.termNumber}
              term={term}
              isExpanded={expandedTerm === term.termNumber}
              isEditing={isEditing}
              onToggleExpand={() =>
                onToggleExpandTerm(expandedTerm === term.termNumber ? null : term.termNumber)
              }
              onUpdateTerm={(updater) => updateTerm(term.termNumber, updater)}
            />
          ))}
        </>
      )}

      {activeTab === 'insights' && <PlanInsightsPanel plan={plan} />}
    </ScrollView>
  );
}
