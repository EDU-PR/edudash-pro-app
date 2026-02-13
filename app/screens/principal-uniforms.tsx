import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { logger } from '@/lib/logger';
import {
  SIZE_OPTIONS, isUniformPaymentRecord,
  deriveUniformData, exportUniformPdf, useUniformMessaging,
} from '@/hooks/principal-uniforms';
import type { UniformRow, StudentRow, DisplayRow } from '@/hooks/principal-uniforms';

export default function PrincipalUniformsScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showAlert, alertProps } = useAlertModal();

  const schoolId = (profile?.organization_id as string) || (profile as any)?.preschool_id || null;

  const [rows, setRows] = useState<UniformRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState('');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'missing'>('all');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generatingNumbers, setGeneratingNumbers] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [paymentStatusByStudent, setPaymentStatusByStudent] = useState<Map<string, 'paid' | 'pending' | 'unpaid'>>(
    () => new Map()
  );

  const { bulkMessaging, bulkMessageMissing, bulkMessageUnpaid } = useUniformMessaging({
    userId: user?.id, schoolId, profile, showAlert,
  });

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const supabase = assertSupabase();
      const [{ data, error }, { data: studentData, error: studentError }] = await Promise.all([
        supabase
          .from('uniform_requests')
          .select('id, child_name, age_years, tshirt_size, tshirt_quantity, shorts_quantity, tshirt_number, is_returning, sample_supplied, created_at, updated_at, student_id, student:students!uniform_requests_student_id_fkey(first_name,last_name,student_id), parent:profiles!uniform_requests_parent_id_fkey(id, first_name,last_name,email,phone)')
          .eq('preschool_id', schoolId)
          .order('created_at', { ascending: false }),
        supabase
          .from('students')
          .select('id, first_name, last_name, student_id, class_id, classroom:classes(id,name), parent:profiles!students_parent_id_fkey(id, first_name,last_name,email,phone), guardian:profiles!students_guardian_id_fkey(id, first_name,last_name,email,phone)')
          .eq('preschool_id', schoolId)
          .eq('is_active', true)
          .order('first_name'),
      ]);
      if (error) throw error;
      if (studentError) throw studentError;
      setRows((data as any) || []);
      setStudents((studentData as any) || []);

      const studentIds = (studentData as any[] | null)?.map((s: any) => s.id).filter(Boolean) || [];
      if (studentIds.length) {
        const [{ data: popData }, { data: paymentsData }] = await Promise.all([
          supabase.from('pop_uploads')
            .select('student_id, status, description, title')
            .eq('preschool_id', schoolId).eq('upload_type', 'proof_of_payment').in('student_id', studentIds),
          supabase.from('payments')
            .select('student_id, status, description, metadata')
            .eq('preschool_id', schoolId).in('student_id', studentIds),
        ]);

        const nextMap = new Map<string, 'paid' | 'pending' | 'unpaid'>();
        studentIds.forEach((id: string) => nextMap.set(id, 'unpaid'));

        const { isUniformLabel } = await import('@/lib/utils/feeUtils');
        (popData || [])
          .filter((pop: any) => isUniformLabel(pop?.description) || isUniformLabel(pop?.title))
          .forEach((pop: any) => {
            const current = nextMap.get(pop.student_id) || 'unpaid';
            if (pop.status === 'approved') { nextMap.set(pop.student_id, 'paid'); return; }
            if (current !== 'paid' && ['pending', 'submitted'].includes(String(pop.status))) {
              nextMap.set(pop.student_id, 'pending');
            }
          });

        (paymentsData || []).filter(isUniformPaymentRecord).forEach((payment: any) => {
          if (!payment.student_id) return;
          if (['completed', 'approved'].includes(String(payment.status))) {
            nextMap.set(payment.student_id, 'paid');
          }
        });

        setPaymentStatusByStudent(nextMap);
      } else {
        setPaymentStatusByStudent(new Map());
      }
    } catch (e: any) {
      logger.error('PrincipalUniforms', 'Load uniform sizes failed', e);
      showAlert({ title: 'Error', message: e?.message || 'Failed to load uniform sizes', buttons: [{ text: 'OK' }] });
    } finally {
      setLoading(false);
    }
  }, [schoolId, showAlert]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const derived = useMemo(
    () => deriveUniformData(rows, students, paymentStatusByStudent),
    [rows, students, paymentStatusByStudent]
  );

  const { submittedRows, missingRows, submittedCount, missingCount,
    missingContactableCount, unpaidContactableCount, sizeSummary, missingByClass } = derived;
  const missingNumberCount = useMemo(
    () => submittedRows.filter((row) => !String(row.tshirtNumber || '').trim()).length,
    [submittedRows]
  );

  const displayRows: DisplayRow[] = useMemo(() => (
    statusFilter === 'submitted' ? submittedRows
      : statusFilter === 'missing' ? missingRows
        : [...submittedRows, ...missingRows]
  ), [missingRows, submittedRows, statusFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return displayRows.filter((row) => {
      const matchesSearch = !q || [row.childName, row.studentCode, row.parentName, row.parentEmail, row.parentPhone, row.className]
        .some((field) => field.toLowerCase().includes(q));
      const matchesSize = sizeFilter === 'all' || row.tshirtSize === sizeFilter || row.status === 'missing';
      return matchesSearch && matchesSize;
    });
  }, [displayRows, search, sizeFilter]);

  const handleExportPdf = useCallback(async () => {
    setExporting(true);
    try {
      await exportUniformPdf({ filtered, sizeSummary, missingByClass, showAlert });
    } catch (e: any) {
      showAlert({ title: 'Export Error', message: e?.message || 'Failed to export PDF', buttons: [{ text: 'OK' }] });
    } finally {
      setExporting(false);
    }
  }, [filtered, sizeSummary, missingByClass, showAlert]);

  const handleGenerateNumbers = useCallback(async () => {
    if (!schoolId) return;

    const submittedWithoutNumber = rows.filter((row) => !String(row?.tshirt_number || '').trim());
    if (submittedWithoutNumber.length === 0) {
      showAlert({
        title: 'No Missing Numbers',
        message: 'All submitted uniform orders already have T-shirt numbers.',
        type: 'info',
        buttons: [{ text: 'OK' }],
      });
      return;
    }

    const usedNumbers = new Set<number>();
    rows.forEach((row) => {
      const raw = String(row?.tshirt_number || '').trim();
      if (!/^\d{1,2}$/.test(raw)) return;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 99) return;
      usedNumbers.add(parsed);
    });

    const availableNumbers: number[] = [];
    for (let i = 1; i <= 99; i += 1) {
      if (!usedNumbers.has(i)) availableNumbers.push(i);
    }

    if (availableNumbers.length === 0) {
      showAlert({
        title: 'Number Pool Full',
        message: 'All 1–2 digit numbers (1-99) are already used.',
        type: 'warning',
        buttons: [{ text: 'OK' }],
      });
      return;
    }

    const orderedMissing = [...submittedWithoutNumber].sort((a, b) => {
      const aTs = new Date(a?.created_at || 0).getTime();
      const bTs = new Date(b?.created_at || 0).getTime();
      return aTs - bTs;
    });

    const assignments = orderedMissing.slice(0, availableNumbers.length).map((row, index) => ({
      id: row.id,
      number: String(availableNumbers[index]),
    }));
    const skippedCount = Math.max(orderedMissing.length - assignments.length, 0);

    setGeneratingNumbers(true);
    try {
      const supabase = assertSupabase();
      const results = await Promise.allSettled(
        assignments.map(async (assignment) => {
          const { error } = await supabase
            .from('uniform_requests')
            .update({
              tshirt_number: assignment.number,
              updated_at: new Date().toISOString(),
            })
            .eq('id', assignment.id)
            .eq('preschool_id', schoolId);
          if (error) throw error;
        })
      );

      const failedCount = results.filter((result) => result.status === 'rejected').length;
      const successCount = assignments.length - failedCount;

      await load();

      if (successCount <= 0) {
        throw new Error('No numbers were assigned. Please try again.');
      }

      const notes: string[] = [`Assigned ${successCount} unique numbers.`];
      if (skippedCount > 0) {
        notes.push(`${skippedCount} order(s) were skipped because only 99 unique 1–2 digit numbers are available.`);
      }
      if (failedCount > 0) {
        notes.push(`${failedCount} update(s) failed. Please retry.`);
      }

      showAlert({
        title: 'Numbers Generated',
        message: notes.join(' '),
        type: failedCount > 0 ? 'warning' : 'success',
        buttons: [{ text: 'OK' }],
      });
    } catch (e: any) {
      showAlert({
        title: 'Generation Failed',
        message: e?.message || 'Unable to generate numbers right now.',
        type: 'error',
        buttons: [{ text: 'OK' }],
      });
    } finally {
      setGeneratingNumbers(false);
    }
  }, [schoolId, rows, load, showAlert]);

  const handleGenerateNumbersPress = useCallback(() => {
    if (!schoolId) return;
    if (missingNumberCount === 0 || generatingNumbers) {
      handleGenerateNumbers();
      return;
    }

    showAlert({
      title: 'Generate T-shirt Numbers',
      message: `Assign unique 1–2 digit numbers (1-99) to ${missingNumberCount} submitted order(s) that are missing numbers?`,
      type: 'info',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Generate', onPress: handleGenerateNumbers },
      ],
    });
  }, [schoolId, missingNumberCount, generatingNumbers, handleGenerateNumbers, showAlert]);

  const paymentStatusMeta = useCallback((status: DisplayRow['paymentStatus']) => {
    if (status === 'paid') return { label: 'Paid', bg: theme.success + '22', border: theme.success + '55', text: theme.success };
    if (status === 'pending') return { label: 'Pending', bg: theme.warning + '22', border: theme.warning + '55', text: theme.warning };
    return { label: 'Unpaid', bg: theme.error + '22', border: theme.error + '55', text: theme.error };
  }, [theme]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Uniform Sizes', headerShown: false }} />
      {!schoolId ? (
        <Text style={styles.muted}>No school found on your profile.</Text>
      ) : (
        <>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Uniform Sizes</Text>
              <Text style={styles.subtitle}>T-shirt size will be used for shorts. Returning numbers included.</Text>
            </View>
            <TouchableOpacity
              style={[styles.exportButton, { backgroundColor: theme.info || '#0EA5E9' }]}
              onPress={handleGenerateNumbersPress}
              disabled={generatingNumbers}
            >
              <Ionicons name="keypad-outline" size={18} color="#fff" />
              <Text style={styles.exportButtonText}>
                {generatingNumbers
                  ? 'Generating...'
                  : missingNumberCount > 0
                    ? `Generate Numbers (${missingNumberCount})`
                    : 'Generate Numbers'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportButton, { backgroundColor: theme.primary }]}
              onPress={handleExportPdf}
              disabled={exporting || filtered.length === 0}
            >
              <Ionicons name="document-text-outline" size={18} color="#fff" />
              <Text style={styles.exportButtonText}>{exporting ? 'Exporting...' : 'Export PDF'}</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search child, parent, or code"
            placeholderTextColor={theme.textSecondary}
          />

          <View style={styles.controlsRow}>
            <View style={styles.countChip}>
              <Ionicons name="checkmark-circle" size={14} color={theme.success || '#22c55e'} />
              <Text style={styles.countChipText}>{submittedCount} submitted</Text>
            </View>
            <View style={styles.countChip}>
              <Ionicons name="alert-circle" size={14} color={theme.warning || '#f59e0b'} />
              <Text style={styles.countChipText}>{missingCount} missing</Text>
            </View>
            <TouchableOpacity
              style={[styles.bulkButton, { backgroundColor: theme.warning || '#f59e0b' }]}
              onPress={() => bulkMessageMissing(missingRows)}
              disabled={bulkMessaging !== null || missingContactableCount === 0}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={16} color="#fff" />
              <Text style={styles.bulkButtonText}>
                {bulkMessaging === 'missing' ? 'Sending...' : 'Message Missing (' + missingContactableCount + ')'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkButton, { backgroundColor: theme.error || '#ef4444' }]}
              onPress={() => bulkMessageUnpaid(submittedRows)}
              disabled={bulkMessaging !== null || unpaidContactableCount === 0}
            >
              <Ionicons name="cash-outline" size={16} color="#fff" />
              <Text style={styles.bulkButtonText}>
                {bulkMessaging === 'unpaid' ? 'Sending...' : 'Message Unpaid (' + unpaidContactableCount + ')'}
              </Text>
            </TouchableOpacity>
            <View style={styles.controlsSpacer} />
            <TouchableOpacity
              style={[styles.toggleButton, showInsights && styles.toggleButtonActive]}
              onPress={() => setShowInsights((prev) => !prev)}
            >
              <Ionicons name="analytics-outline" size={16} color={showInsights ? '#fff' : theme.textSecondary} />
              <Text style={[styles.toggleButtonText, showInsights && styles.toggleButtonTextActive]}>Insights</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, showFilters && styles.toggleButtonActive]}
              onPress={() => setShowFilters((prev) => !prev)}
            >
              <Ionicons name="funnel-outline" size={16} color={showFilters ? '#fff' : theme.textSecondary} />
              <Text style={[styles.toggleButtonText, showFilters && styles.toggleButtonTextActive]}>Filters</Text>
            </TouchableOpacity>
          </View>

          {!showFilters && (
            <View style={styles.filterSummaryRow}>
              <Text style={styles.filterSummaryText}>
                Size: {sizeFilter === 'all' ? 'All' : sizeFilter} &bull; Status: {statusFilter === 'all' ? 'All' : statusFilter}
              </Text>
            </View>
          )}

          {showFilters && (
            <View style={styles.filtersCard}>
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Size</Text>
                <View style={styles.pickerWrap}>
                  <Picker selectedValue={sizeFilter} onValueChange={(value) => setSizeFilter(value)} style={styles.picker}>
                    <Picker.Item label="All sizes" value="all" />
                    {SIZE_OPTIONS.map((size: string) => (
                      <Picker.Item key={size} label={size} value={size} />
                    ))}
                  </Picker>
                </View>
              </View>
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Status</Text>
                <View style={styles.pickerWrap}>
                  <Picker selectedValue={statusFilter} onValueChange={(value) => setStatusFilter(value)} style={styles.picker}>
                    <Picker.Item label="All" value="all" />
                    <Picker.Item label="Submitted" value="submitted" />
                    <Picker.Item label="Missing sizes" value="missing" />
                  </Picker>
                </View>
              </View>
            </View>
          )}

          {showInsights && (
            <View style={styles.insightsCard}>
              <View style={styles.insightBlock}>
                <Text style={styles.summaryTitle}>Size Summary</Text>
                {Object.keys(sizeSummary).length === 0 ? (
                  <Text style={styles.muted}>No submissions yet.</Text>
                ) : (
                  <View style={styles.summaryRow}>
                    {Object.entries(sizeSummary).map(([size, count]) => (
                      <View key={size} style={styles.summaryChip}>
                        <Text style={styles.summaryChipText}>{size}</Text>
                        <Text style={styles.summaryChipCount}>{count}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.insightDivider} />
              <View style={styles.insightBlock}>
                <Text style={styles.summaryTitle}>Missing by Class</Text>
                {missingByClass.length === 0 ? (
                  <Text style={styles.muted}>No missing submissions.</Text>
                ) : (
                  <View style={styles.summaryRow}>
                    {missingByClass.map(({ name, count }: { name: string; count: number }) => (
                      <View key={name} style={styles.summaryChip}>
                        <Text style={styles.summaryChipText}>{name}</Text>
                        <Text style={styles.summaryChipCount}>{count}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
            ListEmptyComponent={
              loading ? <Text style={styles.muted}>Loading...</Text> : <Text style={styles.muted}>No uniform submissions found.</Text>
            }
            renderItem={({ item }) => (
              <View style={[styles.card, item.status === 'missing' && styles.missingCard]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.name}>{item.childName}</Text>
                  {item.status === 'submitted' && (
                    <View style={[styles.paymentChip, {
                      backgroundColor: paymentStatusMeta(item.paymentStatus).bg,
                      borderColor: paymentStatusMeta(item.paymentStatus).border,
                    }]}>
                      <Text style={[styles.paymentChipText, { color: paymentStatusMeta(item.paymentStatus).text }]}>
                        {paymentStatusMeta(item.paymentStatus).label}
                      </Text>
                    </View>
                  )}
                </View>
                {item.status === 'missing' ? (
                  <>
                    <Text style={styles.muted}>No size submitted yet.</Text>
                    {item.parentName || item.parentEmail || item.parentPhone ? (
                      <>
                        {item.parentName ? <Text style={styles.text}>Parent: {item.parentName}</Text> : null}
                        {item.parentEmail ? <Text style={styles.text}>Email: {item.parentEmail}</Text> : null}
                        {item.parentPhone ? <Text style={styles.text}>Phone: {item.parentPhone}</Text> : null}
                      </>
                    ) : (
                      <Text style={styles.muted}>Parent not linked.</Text>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.text}>Age: {item.ageYears ?? '-'}</Text>
                    <Text style={styles.text}>Size: {item.tshirtSize}</Text>
                    <Text style={styles.text}>T-shirts: {item.tshirtQuantity ?? '-'}</Text>
                    <Text style={styles.text}>Shorts: {item.shortsQuantity ?? '-'}</Text>
                    <Text style={styles.text}>Returning: {item.isReturning ? 'Yes' : 'No'}</Text>
                    {item.tshirtNumber
                      ? <Text style={styles.text}>T-shirt Number: {item.tshirtNumber}</Text>
                      : <Text style={styles.muted}>T-shirt Number: not assigned</Text>}
                    <Text style={styles.text}>Sample supplied: {item.sampleSupplied ? 'Yes' : 'No'}</Text>
                    {item.studentCode ? <Text style={styles.text}>Student Code: {item.studentCode}</Text> : null}
                    <Text style={styles.text}>Submitted by: {item.parentName || 'Parent'}</Text>
                    {item.parentEmail ? <Text style={styles.text}>Email: {item.parentEmail}</Text> : null}
                    <Text style={styles.muted}>
                      Last updated: {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('en-ZA') : item.submittedAt ? new Date(item.submittedAt).toLocaleDateString('en-ZA') : '-'}
                    </Text>
                  </>
                )}
              </View>
            )}
          />
        </>
      )}
      <AlertModal {...alertProps} />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme?.background || '#0b1220', padding: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 10 },
  headerText: { flex: 1 },
  title: { color: theme?.text || '#fff', fontSize: 20, fontWeight: '800' },
  subtitle: { color: theme?.textSecondary || '#9CA3AF', fontSize: 12, marginTop: 4 },
  exportButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  exportButtonText: { color: '#fff', fontWeight: '700' },
  search: { backgroundColor: theme?.surface || '#111827', color: theme?.text || '#fff', borderRadius: 10, padding: 10, borderColor: theme?.border || '#1f2937', borderWidth: 1, marginBottom: 6 },
  controlsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 },
  countChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: theme?.surface || '#111827', borderWidth: 1, borderColor: theme?.border || '#1f2937' },
  countChipText: { color: theme?.text || '#fff', fontSize: 12, fontWeight: '600' },
  bulkButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  bulkButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  controlsSpacer: { flexGrow: 1 },
  toggleButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme?.border || '#1f2937', backgroundColor: theme?.surface || '#111827' },
  toggleButtonActive: { backgroundColor: theme?.primary || '#3b82f6', borderColor: theme?.primary || '#3b82f6' },
  toggleButtonText: { color: theme?.textSecondary || '#9CA3AF', fontSize: 12, fontWeight: '700' },
  toggleButtonTextActive: { color: '#fff' },
  filterSummaryRow: { paddingVertical: 4, paddingHorizontal: 6, marginBottom: 6 },
  filterSummaryText: { color: theme?.textSecondary || '#9CA3AF', fontSize: 12, fontWeight: '600' },
  filtersCard: { backgroundColor: theme?.cardBackground || '#111827', borderRadius: 12, padding: 10, borderColor: theme?.border || '#1f2937', borderWidth: 1, marginBottom: 8 },
  insightsCard: { backgroundColor: theme?.cardBackground || '#111827', borderRadius: 12, padding: 10, borderColor: theme?.border || '#1f2937', borderWidth: 1, marginBottom: 8 },
  insightBlock: { marginBottom: 10 },
  insightDivider: { height: 1, backgroundColor: theme?.border || '#1f2937', marginVertical: 6 },
  summaryTitle: { color: theme?.text || '#fff', fontWeight: '700', marginBottom: 8 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: theme?.surface || '#111827', borderWidth: 1, borderColor: theme?.border || '#1f2937' },
  summaryChipText: { color: theme?.text || '#fff', fontWeight: '600', fontSize: 12 },
  summaryChipCount: { color: theme?.textSecondary || '#9CA3AF', fontSize: 12 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  filterLabel: { color: theme?.textSecondary || '#9CA3AF', fontSize: 12, fontWeight: '600' },
  pickerWrap: { flex: 1, borderWidth: 1, borderColor: theme?.border || '#1f2937', borderRadius: 10, overflow: 'hidden', backgroundColor: theme?.surface || '#111827' },
  picker: { color: theme?.text || '#fff' },
  card: { backgroundColor: theme?.cardBackground || '#111827', borderRadius: 12, padding: 12, borderColor: theme?.border || '#1f2937', borderWidth: 1, marginBottom: 10 },
  missingCard: { borderStyle: 'dashed', borderColor: theme?.warning || '#f59e0b' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { color: theme?.text || '#fff', fontWeight: '800', fontSize: 16, marginBottom: 4 },
  paymentChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  paymentChipText: { fontSize: 11, fontWeight: '700' },
  text: { color: theme?.text || '#fff', fontSize: 13 },
  muted: { color: theme?.textSecondary || '#9CA3AF', paddingVertical: 8, fontSize: 12 },
});
