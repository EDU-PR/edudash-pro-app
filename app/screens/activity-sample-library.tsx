/**
 * Activity Sample Library
 *
 * Browsable Literacy, Numeracy, and Life Skills activity samples for teachers and principals.
 * Supports Print and Save to PDF.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAlertModal } from '@/components/ui/AlertModal';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { extractOrganizationId } from '@/lib/tenant/compat';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface ActivitySample {
  id: string;
  strand: string;
  title: string;
  description: string | null;
  age_group: string | null;
  duration_minutes: number | null;
  objectives: string[];
  materials: string[];
  instructions: string | null;
  caps_alignment: string | null;
}

const STRAND_LABELS: Record<string, string> = {
  literacy: 'Literacy',
  numeracy: 'Numeracy',
  life_skills: 'Life Skills',
  creative: 'Creative',
  physical: 'Physical',
  other: 'Other',
};

export default function ActivitySampleLibraryScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { showAlert, AlertModalComponent } = useAlertModal();
  const styles = createStyles(theme);
  const organizationId = extractOrganizationId(profile);

  const [samples, setSamples] = useState<ActivitySample[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStrand, setSelectedStrand] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchSamples = useCallback(async () => {
    try {
      const supabase = assertSupabase();
      let query = supabase
        .from('activity_sample_library')
        .select('*')
        .eq('is_system_template', true)
        .order('strand')
        .order('title');
      if (organizationId) {
        query = query.or(`preschool_id.is.null,preschool_id.eq.${organizationId}`);
      } else {
        query = query.is('preschool_id', null);
      }
      const { data, error } = await query;

      if (error) throw error;
      const rows = (data || []).map((r: any) => ({
        ...r,
        objectives: Array.isArray(r.objectives) ? r.objectives : [],
        materials: Array.isArray(r.materials) ? r.materials : [],
      }));
      setSamples(rows);
    } catch (err) {
      logger.error('[ActivitySampleLibrary]', 'Failed to load samples', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void fetchSamples();
  }, [fetchSamples]);

  const filteredSamples = selectedStrand
    ? samples.filter((s) => s.strand === selectedStrand)
    : samples;

  const buildSampleHTML = useCallback((sample: ActivitySample) => {
    const objList = (sample.objectives || []).map((o) => `<li>${o}</li>`).join('');
    const matList = (sample.materials || []).map((m) => `<li>${m}</li>`).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${sample.title}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;color:#333}h1{font-size:20px;margin-bottom:4px}
.strand{font-size:12px;color:#666;margin-bottom:12px}ul{margin:8px 0;padding-left:20px}
.meta{font-size:12px;color:#888;margin-top:16px}.footer{font-size:11px;color:#999;margin-top:24px}</style></head><body>
<h1>${sample.title}</h1><p class="strand">${STRAND_LABELS[sample.strand] || sample.strand}${sample.age_group ? ` • ${sample.age_group}` : ''}${sample.duration_minutes ? ` • ${sample.duration_minutes} min` : ''}</p>
${sample.description ? `<p>${sample.description}</p>` : ''}
<h3>Objectives</h3><ul>${objList || '<li>—</li>'}</ul>
<h3>Materials</h3><ul>${matList || '<li>—</li>'}</ul>
${sample.instructions ? `<h3>Instructions</h3><p>${sample.instructions}</p>` : ''}
${sample.caps_alignment ? `<p class="meta">${sample.caps_alignment}</p>` : ''}
<p class="footer">EduDash Pro • ${new Date().toLocaleDateString()}</p></body></html>`;
  }, []);

  const handlePrintSample = useCallback(
    async (sample: ActivitySample) => {
      setExporting(true);
      try {
        await Print.printAsync({ html: buildSampleHTML(sample) });
      } catch (err) {
        logger.error('[ActivitySampleLibrary]', 'Print failed', err);
        showAlert({ title: 'Print failed', message: 'Could not open print dialog.' });
      } finally {
        setExporting(false);
      }
    },
    [buildSampleHTML]
  );

  const handleSavePDF = useCallback(
    async (sample: ActivitySample) => {
      setExporting(true);
      try {
        const { uri } = await Print.printToFileAsync({ html: buildSampleHTML(sample), base64: false });
        const filename = `activity-${sample.title.replace(/\s+/g, '-').toLowerCase().slice(0, 30)}.pdf`;
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Save ${filename}` });
        } else {
          showAlert({ title: 'Saved', message: `PDF saved as ${filename}` });
        }
      } catch (err) {
        logger.error('[ActivitySampleLibrary]', 'PDF export failed', err);
        showAlert({ title: 'Export failed', message: 'Could not save PDF.' });
      } finally {
        setExporting(false);
      }
    },
    [buildSampleHTML]
  );

  const strands = Array.from(new Set(samples.map((s) => s.strand)));

  if (loading) {
    return (
      <DesktopLayout role="teacher" title="Activity Samples">
        <Stack.Screen options={{ title: 'Activity Samples', headerShown: false }} />
        <View style={styles.center}>
          <EduDashSpinner />
        </View>
      </DesktopLayout>
    );
  }

  return (
    <DesktopLayout role="teacher" title="Activity Samples">
      <Stack.Screen options={{ title: 'Activity Samples', headerShown: false }} />
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchSamples(); }} />}
      >
        <Text style={styles.heading}>Literacy, Numeracy & Life Skills</Text>
        <Text style={styles.subtitle}>CAPS-aligned activity samples for planning</Text>

        {strands.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strandTabs}>
            <TouchableOpacity
              style={[styles.strandTab, !selectedStrand && styles.strandTabActive]}
              onPress={() => setSelectedStrand(null)}
            >
              <Text style={[styles.strandTabText, !selectedStrand && styles.strandTabTextActive]}>All</Text>
            </TouchableOpacity>
            {strands.map((strand) => (
              <TouchableOpacity
                key={strand}
                style={[styles.strandTab, selectedStrand === strand && styles.strandTabActive]}
                onPress={() => setSelectedStrand(strand)}
              >
                <Text style={[styles.strandTabText, selectedStrand === strand && styles.strandTabTextActive]}>
                  {STRAND_LABELS[strand] || strand}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {filteredSamples.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={48} color={theme.textSecondary} />
            <Text style={styles.emptyText}>No activity samples found</Text>
          </View>
        ) : (
          filteredSamples.map((sample) => (
            <View key={sample.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.strandBadge}>{STRAND_LABELS[sample.strand] || sample.strand}</Text>
                  <Text style={styles.cardTitle}>{sample.title}</Text>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handlePrintSample(sample)}
                    disabled={exporting}
                  >
                    <Ionicons name="print-outline" size={18} color={theme.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleSavePDF(sample)}
                    disabled={exporting}
                  >
                    <Ionicons name="document-outline" size={18} color={theme.primary} />
                  </TouchableOpacity>
                </View>
              </View>
              {sample.description && <Text style={styles.description}>{sample.description}</Text>}
              <Text style={styles.meta}>
                {[sample.age_group, sample.duration_minutes ? `${sample.duration_minutes} min` : null]
                  .filter(Boolean)
                  .join(' • ')}
              </Text>
            </View>
          ))
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
      <AlertModalComponent />
    </DesktopLayout>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, padding: 16 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    heading: { fontSize: 22, fontWeight: '700', color: theme.text, marginBottom: 4 },
    subtitle: { fontSize: 14, color: theme.textSecondary, marginBottom: 16 },
    strandTabs: { flexDirection: 'row', marginBottom: 16 },
    strandTab: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: theme.cardBackground || theme.surface,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    strandTabActive: { backgroundColor: `${theme.primary}15`, borderColor: theme.primary },
    strandTabText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
    strandTabTextActive: { color: theme.primary },
    emptyState: { alignItems: 'center', paddingVertical: 48 },
    emptyText: { fontSize: 16, fontWeight: '600', color: theme.text, marginTop: 12 },
    card: {
      backgroundColor: theme.cardBackground || theme.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardTitleRow: { flex: 1 },
    strandBadge: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.primary,
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: theme.text },
    actions: { flexDirection: 'row', gap: 8 },
    actionBtn: { padding: 6 },
    description: { fontSize: 14, color: theme.textSecondary, marginTop: 8 },
    meta: { fontSize: 12, color: theme.textSecondary, marginTop: 4 },
  });
