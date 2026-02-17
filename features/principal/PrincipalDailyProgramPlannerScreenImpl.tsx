import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { extractOrganizationId } from '@/lib/tenant/compat';
import type { DailyProgramBlock, WeeklyProgramDraft } from '@/types/ecd-planning';
import { WeeklyProgramCopilotService } from '@/lib/services/weeklyProgramCopilotService';
import {
  WeeklyProgramService,
  type ProgramTimeRules,
} from '@/lib/services/weeklyProgramService';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

const DAY_ORDER = [1, 2, 3, 4, 5] as const;
const DAY_LABELS: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfWeekMonday(value: Date | string): string {
  const date = typeof value === 'string'
    ? new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`)
    : new Date(value);

  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const day = safeDate.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  safeDate.setUTCDate(safeDate.getUTCDate() + offset);
  return toDateOnly(safeDate);
}

function addDays(dateLike: string, days: number): string {
  const date = new Date(`${dateLike}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateOnly(date);
}

function normalizeTime(value: string): string {
  const trimmed = String(value || '').trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return trimmed;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return trimmed;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return trimmed;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

const buildDefaultRules = (): ProgramTimeRules => ({
  arrivalStartTime: '07:30',
  arrivalCutoffTime: '08:30',
  pickupStartTime: '13:00',
  pickupCutoffTime: '14:00',
});

export default function PrincipalDailyProgramPlannerScreen() {
  const { theme } = useTheme();
  const { profile, user } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const organizationId = extractOrganizationId(profile);
  const userId = user?.id || profile?.id;

  const [weekStartDate, setWeekStartDate] = useState(() => startOfWeekMonday(new Date()));
  const [themeTitle, setThemeTitle] = useState('Healthy Habits');
  const [ageGroup, setAgeGroup] = useState('3-6');
  const [weeklyObjectives, setWeeklyObjectives] = useState('Routine consistency, self-help skills, social confidence');
  const [dailyMinutes, setDailyMinutes] = useState('300');
  const [budgetLevel, setBudgetLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [includeAssessment, setIncludeAssessment] = useState(true);
  const [includeParentTips, setIncludeParentTips] = useState(true);

  const [rules, setRules] = useState<ProgramTimeRules>(buildDefaultRules());

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [draft, setDraft] = useState<WeeklyProgramDraft | null>(null);
  const [programs, setPrograms] = useState<WeeklyProgramDraft[]>([]);

  const loadPrograms = useCallback(async () => {
    if (!organizationId) {
      setPrograms([]);
      return;
    }

    try {
      const data = await WeeklyProgramService.listWeeklyPrograms({
        preschoolId: organizationId,
        limit: 16,
      });
      setPrograms(data);
    } catch (error: unknown) {
      console.error('Failed to load weekly programs:', error);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadPrograms();
  }, [loadPrograms]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPrograms();
    setRefreshing(false);
  }, [loadPrograms]);

  const generateProgram = useCallback(async () => {
    if (!organizationId || !userId) {
      Alert.alert('Missing profile', 'Please sign in again to continue.');
      return;
    }

    if (!themeTitle.trim()) {
      Alert.alert('Theme required', 'Please add a weekly theme.');
      return;
    }

    setGenerating(true);
    try {
      const generated = await WeeklyProgramCopilotService.generateWeeklyProgramFromTerm({
        preschoolId: organizationId,
        createdBy: userId,
        weekStartDate,
        theme: themeTitle.trim(),
        ageGroup: ageGroup.trim() || '3-6',
        weeklyObjectives: weeklyObjectives
          .split(/[\n,;|]/g)
          .map((item) => item.trim())
          .filter(Boolean),
        constraints: {
          dailyMinutes: Math.max(120, Number(dailyMinutes) || 300),
          budgetLevel,
          includeAssessmentBlock: includeAssessment,
          includeParentTipPerDay: includeParentTips,
        },
      });

      setDraft({
        ...generated,
        preschool_id: organizationId,
        created_by: userId,
        week_start_date: startOfWeekMonday(weekStartDate),
        week_end_date: addDays(startOfWeekMonday(weekStartDate), 4),
      });

      Alert.alert('Draft ready', 'AI generated your daily routine. Review and share when ready.');
    } catch (error: unknown) {
      Alert.alert('Generation failed', error instanceof Error ? error.message : 'Could not generate program.');
    } finally {
      setGenerating(false);
    }
  }, [
    ageGroup,
    budgetLevel,
    dailyMinutes,
    includeAssessment,
    includeParentTips,
    organizationId,
    themeTitle,
    userId,
    weekStartDate,
    weeklyObjectives,
  ]);

  const saveDraft = useCallback(async (): Promise<WeeklyProgramDraft | null> => {
    if (!draft) {
      Alert.alert('No draft', 'Generate or load a draft first.');
      return null;
    }

    if (!organizationId || !userId) {
      Alert.alert('Missing profile', 'Please sign in again to continue.');
      return null;
    }

    setSaving(true);
    try {
      const saved = await WeeklyProgramService.saveWeeklyProgram({
        weeklyProgram: {
          ...draft,
          preschool_id: organizationId,
          created_by: userId,
          week_start_date: startOfWeekMonday(draft.week_start_date || weekStartDate),
          week_end_date: addDays(startOfWeekMonday(draft.week_start_date || weekStartDate), 4),
          age_group: draft.age_group || ageGroup,
          title: draft.title || `${themeTitle} Daily Program`,
          summary: draft.summary || `${themeTitle} routine plan for the week`,
          status: draft.status || 'draft',
        },
      });

      setDraft(saved);
      await loadPrograms();
      Alert.alert('Saved', 'Daily routine draft saved successfully.');
      return saved;
    } catch (error: unknown) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Failed to save draft.');
      return null;
    } finally {
      setSaving(false);
    }
  }, [ageGroup, draft, loadPrograms, organizationId, themeTitle, userId, weekStartDate]);

  const shareWithParents = useCallback(async (programOverride?: WeeklyProgramDraft) => {
    const activeProgram = programOverride || draft;
    if (!activeProgram) {
      Alert.alert('No program', 'Generate or load a program before sharing.');
      return;
    }

    if (!organizationId || !userId) {
      Alert.alert('Missing profile', 'Please sign in again to continue.');
      return;
    }

    const { normalized, issues } = WeeklyProgramService.validateProgramTimeRules(rules);
    if (issues.length > 0) {
      Alert.alert('Fix time rules', issues.join('\n'));
      return;
    }

    setSharing(true);
    try {
      let programToShare = activeProgram;
      if (!programToShare.id) {
        const saved = await saveDraft();
        if (!saved?.id) {
          setSharing(false);
          return;
        }
        programToShare = saved;
      }

      await WeeklyProgramService.shareWeeklyProgramWithParents({
        weeklyProgramId: programToShare.id,
        preschoolId: organizationId,
        sharedBy: userId,
        rules: normalized,
      });

      await loadPrograms();
      Alert.alert(
        'Shared with Parents',
        'Routine shared with strict arrival and pickup rules. Parents received a published announcement.',
      );
    } catch (error: unknown) {
      Alert.alert('Share failed', error instanceof Error ? error.message : 'Could not share routine.');
    } finally {
      setSharing(false);
    }
  }, [draft, loadPrograms, organizationId, rules, saveDraft, userId]);

  const applyPreset = useCallback((preset: 'half_day' | 'full_day') => {
    if (preset === 'half_day') {
      setRules({
        arrivalStartTime: '07:30',
        arrivalCutoffTime: '08:30',
        pickupStartTime: '12:30',
        pickupCutoffTime: '13:30',
      });
      return;
    }

    setRules({
      arrivalStartTime: '07:00',
      arrivalCutoffTime: '08:30',
      pickupStartTime: '16:00',
      pickupCutoffTime: '17:00',
    });
  }, []);

  const updateDraftBlock = useCallback((day: number, order: number, patch: Partial<DailyProgramBlock>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((block) => {
          if (block.day_of_week !== day || block.block_order !== order) return block;
          return { ...block, ...patch };
        }),
      };
    });
  }, []);

  const addBlockForDay = useCallback((day: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const dayBlocks = prev.blocks.filter((block) => block.day_of_week === day);
      const nextOrder = dayBlocks.length > 0 ? Math.max(...dayBlocks.map((block) => block.block_order)) + 1 : 1;

      return {
        ...prev,
        blocks: [
          ...prev.blocks,
          {
            day_of_week: day as 1 | 2 | 3 | 4 | 5 | 6 | 7,
            block_order: nextOrder,
            block_type: 'learning',
            title: `Block ${nextOrder}`,
            start_time: null,
            end_time: null,
            objectives: [],
            materials: [],
            transition_cue: null,
            notes: null,
            parent_tip: '',
          },
        ],
      };
    });
  }, []);

  const removeBlock = useCallback((day: number, order: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const remaining = prev.blocks
        .filter((block) => !(block.day_of_week === day && block.block_order === order))
        .map((block) => ({ ...block }));

      return {
        ...prev,
        blocks: remaining,
      };
    });
  }, []);

  const loadProgramIntoEditor = useCallback((program: WeeklyProgramDraft) => {
    setWeekStartDate(startOfWeekMonday(program.week_start_date));
    setThemeTitle(program.title || themeTitle);
    setAgeGroup(program.age_group || '3-6');
    setDraft(program);
    Alert.alert('Loaded', 'Program loaded into editor.');
  }, [themeTitle]);

  const programStats = useMemo(() => {
    const draftBlocks = draft?.blocks || [];
    const totalBlocks = draftBlocks.length;
    const parentTipCount = draftBlocks.filter((block) => !!block.parent_tip?.trim()).length;
    return { totalBlocks, parentTipCount };
  }, [draft?.blocks]);

  return (
    <DesktopLayout role="principal" title="AI Daily Routine Planner" showBackButton>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <LinearGradient
          colors={[theme.primary + '30', theme.primary + '12', theme.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="sparkles" size={22} color={theme.primary} />
            </View>
            <Text style={styles.heroTag}>AI Copilot</Text>
          </View>
          <Text style={styles.heroTitle}>Daily Routine & Program Helper</Text>
          <Text style={styles.heroSubtitle}>
            Generate a practical day flow, lock strict arrival/pickup windows, and share it with parents in one publish flow.
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>Blocks</Text>
              <Text style={styles.statValue}>{programStats.totalBlocks}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>Parent Tips</Text>
              <Text style={styles.statValue}>{programStats.parentTipCount}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>Saved Plans</Text>
              <Text style={styles.statValue}>{programs.length}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Program Setup</Text>
          <TextInput
            style={styles.input}
            value={weekStartDate}
            onChangeText={(value) => setWeekStartDate(value)}
            placeholder="Week start (YYYY-MM-DD)"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            value={themeTitle}
            onChangeText={setThemeTitle}
            placeholder="Weekly theme"
            placeholderTextColor={theme.textSecondary}
          />

          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              value={ageGroup}
              onChangeText={setAgeGroup}
              placeholder="Age group"
              placeholderTextColor={theme.textSecondary}
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              value={dailyMinutes}
              onChangeText={setDailyMinutes}
              placeholder="Daily minutes"
              keyboardType="number-pad"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <TextInput
            style={styles.input}
            value={weeklyObjectives}
            onChangeText={setWeeklyObjectives}
            placeholder="Objectives (comma-separated)"
            placeholderTextColor={theme.textSecondary}
            multiline
          />

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.togglePill, includeAssessment && styles.togglePillActive]}
              onPress={() => setIncludeAssessment((prev) => !prev)}
            >
              <Text style={[styles.toggleText, includeAssessment && styles.toggleTextActive]}>Assessment Block</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.togglePill, includeParentTips && styles.togglePillActive]}
              onPress={() => setIncludeParentTips((prev) => !prev)}
            >
              <Text style={[styles.toggleText, includeParentTips && styles.toggleTextActive]}>Parent Tips</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            {(['low', 'medium', 'high'] as const).map((level) => (
              <TouchableOpacity
                key={level}
                style={[styles.togglePill, budgetLevel === level && styles.togglePillActive]}
                onPress={() => setBudgetLevel(level)}
              >
                <Text style={[styles.toggleText, budgetLevel === level && styles.toggleTextActive]}>
                  {level.charAt(0).toUpperCase() + level.slice(1)} Budget
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Strict Arrival & Pickup Rules</Text>
          <Text style={styles.sectionHint}>
            These limits are enforced before parents can receive the routine. Program blocks outside this window are blocked from publishing.
          </Text>

          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              value={rules.arrivalStartTime}
              onChangeText={(value) => setRules((prev) => ({ ...prev, arrivalStartTime: normalizeTime(value) }))}
              placeholder="Arrival starts (HH:MM)"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              value={rules.arrivalCutoffTime}
              onChangeText={(value) => setRules((prev) => ({ ...prev, arrivalCutoffTime: normalizeTime(value) }))}
              placeholder="Arrival cutoff"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              value={rules.pickupStartTime}
              onChangeText={(value) => setRules((prev) => ({ ...prev, pickupStartTime: normalizeTime(value) }))}
              placeholder="Pickup starts"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              value={rules.pickupCutoffTime}
              onChangeText={(value) => setRules((prev) => ({ ...prev, pickupCutoffTime: normalizeTime(value) }))}
              placeholder="Pickup cutoff"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.presetRow}>
            <TouchableOpacity style={styles.presetBtn} onPress={() => applyPreset('half_day')}>
              <Text style={styles.presetBtnText}>Half-Day Preset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetBtn} onPress={() => applyPreset('full_day')}>
              <Text style={styles.presetBtnText}>Full-Day Preset</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.actionsCard}>
          <TouchableOpacity style={styles.primaryBtn} onPress={generateProgram} disabled={generating}>
            {generating ? <EduDashSpinner size="small" color="#fff" /> : <Ionicons name="sparkles" size={16} color="#fff" />}
            <Text style={styles.primaryBtnText}>{generating ? 'Generating...' : 'Generate with Dash AI'}</Text>
          </TouchableOpacity>

          <View style={styles.row}>
            <TouchableOpacity style={[styles.secondaryBtn, styles.halfButton]} onPress={() => void saveDraft()} disabled={saving || !draft}>
              {saving ? <EduDashSpinner size="small" color={theme.primary} /> : <Ionicons name="save-outline" size={16} color={theme.primary} />}
              <Text style={styles.secondaryBtnText}>{saving ? 'Saving...' : 'Save Draft'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.successBtn, styles.halfButton]}
              onPress={() => void shareWithParents()}
              disabled={sharing || !draft}
            >
              {sharing ? <EduDashSpinner size="small" color="#fff" /> : <Ionicons name="megaphone-outline" size={16} color="#fff" />}
              <Text style={styles.successBtnText}>{sharing ? 'Sharing...' : 'Share with Parents'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {draft && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Draft Blocks</Text>
            <Text style={styles.sectionHint}>Tune times, titles, and parent tips before sharing.</Text>

            {DAY_ORDER.map((day) => {
              const dayBlocks = draft.blocks
                .filter((block) => block.day_of_week === day)
                .sort((a, b) => a.block_order - b.block_order);

              return (
                <View key={day} style={styles.daySection}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayTitle}>{DAY_LABELS[day]}</Text>
                    <TouchableOpacity style={styles.inlineBtn} onPress={() => addBlockForDay(day)}>
                      <Ionicons name="add" size={14} color={theme.primary} />
                      <Text style={styles.inlineBtnText}>Add Block</Text>
                    </TouchableOpacity>
                  </View>

                  {dayBlocks.length === 0 ? (
                    <Text style={styles.dayEmpty}>No blocks yet.</Text>
                  ) : (
                    dayBlocks.map((block) => (
                      <View key={`${day}-${block.block_order}`} style={styles.blockCard}>
                        <View style={styles.blockTitleRow}>
                          <Text style={styles.blockBadge}>#{block.block_order}</Text>
                          <TouchableOpacity onPress={() => removeBlock(day, block.block_order)}>
                            <Ionicons name="trash-outline" size={16} color={theme.error} />
                          </TouchableOpacity>
                        </View>
                        <TextInput
                          style={styles.input}
                          value={block.title}
                          onChangeText={(value) => updateDraftBlock(day, block.block_order, { title: value })}
                          placeholder="Block title"
                          placeholderTextColor={theme.textSecondary}
                        />
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.halfInput]}
                            value={String(block.start_time || '')}
                            onChangeText={(value) => updateDraftBlock(day, block.block_order, { start_time: normalizeTime(value) })}
                            placeholder="Start HH:MM"
                            placeholderTextColor={theme.textSecondary}
                            autoCapitalize="none"
                          />
                          <TextInput
                            style={[styles.input, styles.halfInput]}
                            value={String(block.end_time || '')}
                            onChangeText={(value) => updateDraftBlock(day, block.block_order, { end_time: normalizeTime(value) })}
                            placeholder="End HH:MM"
                            placeholderTextColor={theme.textSecondary}
                            autoCapitalize="none"
                          />
                        </View>
                        <TextInput
                          style={styles.input}
                          value={block.parent_tip || ''}
                          onChangeText={(value) => updateDraftBlock(day, block.block_order, { parent_tip: value })}
                          placeholder="Parent tip (optional)"
                          placeholderTextColor={theme.textSecondary}
                        />
                      </View>
                    ))
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Saved Programs</Text>
          {programs.length === 0 ? (
            <Text style={styles.sectionHint}>No saved daily programs yet.</Text>
          ) : (
            programs.map((program) => (
              <View key={program.id} style={styles.savedCard}>
                <View style={styles.savedHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.savedTitle}>{program.title || 'Weekly Program'}</Text>
                    <Text style={styles.savedMeta}>
                      {program.week_start_date} to {program.week_end_date}
                    </Text>
                  </View>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>{program.status || 'draft'}</Text>
                  </View>
                </View>

                <View style={styles.savedActions}>
                  <TouchableOpacity style={styles.inlineBtn} onPress={() => loadProgramIntoEditor(program)}>
                    <Ionicons name="create-outline" size={14} color={theme.primary} />
                    <Text style={styles.inlineBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.inlineBtn} onPress={() => void shareWithParents(program)}>
                    <Ionicons name="megaphone-outline" size={14} color={theme.primary} />
                    <Text style={styles.inlineBtnText}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </DesktopLayout>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      padding: 16,
      gap: 12,
      paddingBottom: 36,
    },
    hero: {
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.primary + '40',
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    heroIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.background + 'aa',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.primary + '30',
    },
    heroTag: {
      color: theme.primary,
      fontWeight: '700',
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    heroTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '800',
    },
    heroSubtitle: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 4,
    },
    statsRow: {
      marginTop: 14,
      flexDirection: 'row',
      gap: 8,
    },
    statPill: {
      flex: 1,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background + 'b3',
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    statLabel: {
      color: theme.textSecondary,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    statValue: {
      color: theme.text,
      fontWeight: '800',
      fontSize: 16,
      marginTop: 2,
    },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 14,
      gap: 8,
    },
    actionsCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.primary + '35',
      backgroundColor: theme.primary + '10',
      padding: 14,
      gap: 10,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '800',
    },
    sectionHint: {
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 17,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      backgroundColor: theme.background,
      color: theme.text,
      paddingHorizontal: 11,
      paddingVertical: 10,
      fontSize: 14,
    },
    row: {
      flexDirection: 'row',
      gap: 8,
    },
    halfInput: {
      flex: 1,
    },
    toggleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 2,
    },
    togglePill: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 11,
      paddingVertical: 7,
      backgroundColor: theme.background,
    },
    togglePillActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '18',
    },
    toggleText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    toggleTextActive: {
      color: theme.primary,
    },
    presetRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    presetBtn: {
      flex: 1,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 10,
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    presetBtnText: {
      color: theme.text,
      fontWeight: '700',
      fontSize: 12,
    },
    primaryBtn: {
      borderRadius: 12,
      backgroundColor: theme.primary,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    primaryBtnText: {
      color: '#fff',
      fontWeight: '800',
      fontSize: 14,
    },
    secondaryBtn: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.primary,
      backgroundColor: theme.background,
      paddingVertical: 11,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    secondaryBtnText: {
      color: theme.primary,
      fontWeight: '800',
      fontSize: 13,
    },
    successBtn: {
      borderRadius: 12,
      backgroundColor: '#059669',
      paddingVertical: 11,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    successBtnText: {
      color: '#fff',
      fontWeight: '800',
      fontSize: 13,
    },
    halfButton: {
      flex: 1,
    },
    daySection: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 10,
      gap: 8,
      backgroundColor: theme.background + 'cc',
    },
    dayHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dayTitle: {
      color: theme.text,
      fontWeight: '800',
      fontSize: 13,
    },
    dayEmpty: {
      color: theme.textSecondary,
      fontSize: 12,
    },
    blockCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 10,
      gap: 8,
      backgroundColor: theme.card,
    },
    blockTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    blockBadge: {
      color: theme.primary,
      fontWeight: '700',
      fontSize: 12,
    },
    inlineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderWidth: 1,
      borderColor: theme.primary + '55',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: theme.primary + '12',
    },
    inlineBtnText: {
      color: theme.primary,
      fontWeight: '700',
      fontSize: 12,
    },
    savedCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 11,
      backgroundColor: theme.background,
      gap: 10,
    },
    savedHeader: {
      flexDirection: 'row',
      gap: 8,
    },
    savedTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
    },
    savedMeta: {
      color: theme.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    statusPill: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 9,
      paddingVertical: 5,
      alignSelf: 'flex-start',
      backgroundColor: theme.card,
    },
    statusPillText: {
      color: theme.textSecondary,
      fontSize: 11,
      textTransform: 'capitalize',
      fontWeight: '700',
    },
    savedActions: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
  });
