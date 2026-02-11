import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlertModal } from '@/hooks/useAlertModal';
import AlertModal from '@/components/ui/AlertModal';
import { useUniformRegister } from '@/hooks/useUniformRegister';
import UniformSummaryCards from '@/components/principal/UniformSummaryCards';
import UniformStudentRow from '@/components/principal/UniformStudentRow';
import UniformFilterBar from '@/components/principal/UniformFilterBar';

export default function UniformRegisterScreen() {
  const { preschoolId, schoolName } = useLocalSearchParams<{
    preschoolId: string;
    schoolName: string;
  }>();
  const theme = useTheme();
  const { alertState, showAlert, hideAlert } = useAlertModal();

  const {
    entries, summary, loading, refreshing, processing,
    filter, setFilter,
    handleVerifyPayment, handlePrint, handleSharePdf, handleSendList,
    onRefresh,
  } = useUniformRegister(preschoolId, schoolName || 'School', showAlert);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors?.background || '#fff' }]}>
        <ActivityIndicator size="large" color={theme.colors?.primary || '#1e40af'} />
        <Text style={styles.loadingText}>Loading uniform register…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors?.background || '#f8fafc' }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <Text style={[styles.title, { color: theme.colors?.text || '#111' }]}>
          📋 Uniform Register
        </Text>

        {/* Summary */}
        <UniformSummaryCards summary={summary} />

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#1e40af' }]}
            onPress={handlePrint}
            disabled={processing}
          >
            <Ionicons name="print-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Print</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#7c3aed' }]}
            onPress={handleSharePdf}
            disabled={processing}
          >
            <Ionicons name="share-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Share PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#059669' }]}
            onPress={handleSendList}
            disabled={processing}
          >
            <Ionicons name="send-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Send List</Text>
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <UniformFilterBar filter={filter} setFilter={setFilter} />

        {/* List */}
        <Text style={styles.countText}>
          Showing {entries.length} of {summary.total_students} students
        </Text>
        {entries.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="shirt-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyText}>No students match the current filter</Text>
          </View>
        ) : (
          entries.map((entry) => (
            <UniformStudentRow
              key={entry.id}
              entry={entry}
              onVerifyPayment={handleVerifyPayment}
              processing={processing}
            />
          ))
        )}
      </ScrollView>

      <AlertModal
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        buttons={alertState.buttons}
        onClose={hideAlert}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6b7280' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
  },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  countText: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { marginTop: 8, fontSize: 14, color: '#9ca3af' },
});
