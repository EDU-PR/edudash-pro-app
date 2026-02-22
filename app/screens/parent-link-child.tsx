import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ParentJoinService, type GuardianRequest, type SearchedStudent } from '@/lib/services/parentJoinService';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

type Relationship = 'mother' | 'father' | 'guardian' | 'other';
const RELATIONSHIPS: Relationship[] = ['mother', 'father', 'guardian', 'other'];
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
const calculateAge = (dob?: string | null) => {
  if (!dob) return null;
  const b = new Date(dob);
  const t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age -= 1;
  return age;
};

export default function ParentLinkChildScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const { showAlert, alertProps } = useAlertModal();
  const schoolId = (
    (profile as any)?.organization_membership?.organization_id ||
    (profile as any)?.organization_id ||
    (profile as any)?.preschool_id ||
    null
  ) as string | null;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedStudent[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<SearchedStudent | null>(null);
  const [relationship, setRelationship] = useState<Relationship>('mother');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<GuardianRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const pendingRequests = requests.filter((request) => request.status === 'pending');
  const linkFlow = [
    '1. Search your child by full name or student ID.',
    '2. Select the matching child profile from results.',
    '3. Choose your relationship and submit the request.',
    '4. School admin approves the link before messaging and dashboard data unlock.',
  ];

  const loadRequests = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (isRefresh) setRefreshing(true);
    else setLoadingRequests(true);
    try {
      setRequests(await ParentJoinService.myRequests(user.id));
    } catch (error: any) {
      showAlert({ type: 'error', title: 'Unable to load requests', message: error?.message || 'Please try again in a moment.' });
    } finally {
      setLoadingRequests(false);
      setRefreshing(false);
    }
  }, [showAlert, user?.id]);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  const runSearch = useCallback(async (query?: string, manual = true) => {
    const searchText = (query ?? searchQuery).trim();
    if (!searchText) {
      setSearchResults([]);
      return;
    }
    if (!schoolId) {
      if (manual) showAlert({ type: 'warning', title: 'School not linked', message: "Your account is not linked to a school yet. Join your school first, then search for your child." });
      return;
    }
    setSearching(true);
    try {
      const results = await ParentJoinService.searchStudents(schoolId, searchText);
      setSearchResults(results);
      if (manual && results.length === 0) showAlert({ type: 'info', title: 'No students found', message: `No results for "${searchText}". Check spelling and try again.` });
    } catch (error: any) {
      if (manual) showAlert({ type: 'error', title: 'Search failed', message: error?.message || 'Could not search students right now.' });
    } finally {
      setSearching(false);
    }
  }, [schoolId, searchQuery, showAlert]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => { void runSearch(searchQuery, false); }, 450);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [runSearch, searchQuery]);

  const cancelRequest = useCallback(async (requestId: string) => {
    if (!user?.id) return;
    try {
      await ParentJoinService.cancel(requestId, user.id);
      await loadRequests();
      showAlert({ type: 'success', title: 'Request cancelled', message: 'Your pending link request was cancelled.' });
    } catch (error: any) {
      showAlert({ type: 'error', title: 'Could not cancel request', message: error?.message || 'Please try again later.' });
    }
  }, [loadRequests, showAlert, user?.id]);

  const submitRequest = useCallback(async () => {
    if (!user?.id) return;
    if (!selectedStudent) {
      showAlert({ type: 'warning', title: 'Select a student', message: 'Search and select your child before submitting.' });
      return;
    }
    setSubmitting(true);
    try {
      await ParentJoinService.requestLink({
        schoolId: selectedStudent.preschool_id || schoolId || null,
        parentAuthId: user.id,
        parentEmail: user.email || null,
        studentId: selectedStudent.id,
        childFullName: `${selectedStudent.first_name} ${selectedStudent.last_name}`,
        childClass: selectedStudent.age_group?.name || null,
        relationship,
      });
      await loadRequests();
      setSearchQuery('');
      setSearchResults([]);
      setSelectedStudent(null);
      showAlert({ type: 'success', title: 'Request sent', message: 'Your request has been submitted to the school for approval.' });
    } catch (error: any) {
      const msg = typeof error?.message === 'string' ? error.message : '';
      showAlert({ type: 'error', title: 'Request failed', message: msg.includes('pending request') ? 'You already have a pending request for this child.' : msg || 'Could not submit request right now.' });
    } finally {
      setSubmitting(false);
    }
  }, [loadRequests, relationship, schoolId, selectedStudent, showAlert, user?.email, user?.id]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Link Your Child', headerStyle: { backgroundColor: theme.background }, headerTintColor: theme.primary, headerShadowVisible: false }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadRequests(true)} tintColor={theme.primary} />}
      >
        <View style={[styles.card, { backgroundColor: theme.primary + '12', borderColor: theme.primary + '44' }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>How to link your child</Text>
          {linkFlow.map((step) => (
            <Text key={step} style={[styles.cardSubtitle, { color: theme.textSecondary, marginBottom: 6 }]}>
              {step}
            </Text>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Find your child</Text>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Search by student name or ID.</Text>

          <View style={[styles.searchInputWrap, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Ionicons name="search" size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Type your child's name"
              placeholderTextColor={theme.textSecondary}
              onSubmitEditing={() => void runSearch(undefined, true)}
              returnKeyType="search"
              autoCapitalize="words"
            />
          </View>

          <TouchableOpacity
            onPress={() => void runSearch(undefined, true)}
            disabled={searching || !searchQuery.trim()}
            style={[styles.primaryButton, { backgroundColor: theme.primary, opacity: searching || !searchQuery.trim() ? 0.65 : 1 }]}
          >
            {searching ? <EduDashSpinner size="small" color={theme.onPrimary} /> : <Text style={[styles.primaryButtonText, { color: theme.onPrimary }]}>Search Students</Text>}
          </TouchableOpacity>

          {searchResults.map((student) => {
            const isSelected = selectedStudent?.id === student.id;
            const age = calculateAge(student.date_of_birth);
            return (
              <TouchableOpacity key={student.id} style={[styles.resultItem, { backgroundColor: theme.background, borderColor: isSelected ? theme.primary : theme.border }]} onPress={() => setSelectedStudent(student)}>
                <View style={styles.resultTextWrap}>
                  <Text style={[styles.resultName, { color: theme.text }]}>{student.first_name} {student.last_name}</Text>
                  <Text style={[styles.resultMeta, { color: theme.textSecondary }]}>{age !== null ? `Age ${age}` : 'Age unknown'}{student.age_group?.name ? ` • ${student.age_group.name}` : ''}{student.student_id ? ` • ${student.student_id}` : ''}</Text>
                </View>
                <Ionicons name={isSelected ? 'checkmark-circle' : 'chevron-forward'} size={20} color={isSelected ? theme.primary : theme.textSecondary} />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Relationship</Text>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Select your relationship to the child.</Text>
          <View style={styles.relationshipGrid}>
            {RELATIONSHIPS.map((item) => {
              const active = relationship === item;
              return (
                <TouchableOpacity key={item} style={[styles.relationshipChip, { backgroundColor: active ? theme.primary : theme.background, borderColor: active ? theme.primary : theme.border }]} onPress={() => setRelationship(item)}>
                  <Text style={[styles.relationshipText, { color: active ? theme.onPrimary : theme.text }]}>{item.charAt(0).toUpperCase() + item.slice(1)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity onPress={() => void submitRequest()} disabled={submitting || !selectedStudent} style={[styles.primaryButton, { backgroundColor: theme.primary, opacity: submitting || !selectedStudent ? 0.6 : 1 }]}>
            {submitting ? <EduDashSpinner size="small" color={theme.onPrimary} /> : <Text style={[styles.primaryButtonText, { color: theme.onPrimary }]}>Submit Link Request</Text>}
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.pendingHeader}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Pending requests</Text>
            {loadingRequests ? <EduDashSpinner size="small" color={theme.primary} /> : null}
          </View>

          {pendingRequests.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No pending link requests.</Text>
          ) : (
            pendingRequests.map((request) => (
              <View key={request.id} style={[styles.pendingItem, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <View style={styles.pendingBody}>
                  <Text style={[styles.pendingName, { color: theme.text }]}>{request.child_full_name || 'Child request'}</Text>
                  <Text style={[styles.pendingMeta, { color: theme.textSecondary }]}>Requested {formatDate(request.created_at)}{request.relationship ? ` • ${request.relationship}` : ''}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => showAlert({ type: 'warning', title: 'Cancel this request?', message: 'This will withdraw your pending link request.', buttons: [
                    { text: 'Keep Request' },
                    { text: 'Cancel Request', style: 'destructive', onPress: () => void cancelRequest(request.id) },
                  ] })}
                  style={[styles.cancelBtn, { borderColor: theme.error, backgroundColor: theme.errorLight }]}
                >
                  <Text style={[styles.cancelText, { color: theme.errorDark }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <AlertModal {...alertProps} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  cardSubtitle: { fontSize: 14, marginBottom: 12 },
  searchInputWrap: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 12, marginLeft: 8 },
  primaryButton: { borderRadius: 10, minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryButtonText: { fontSize: 15, fontWeight: '700' },
  resultItem: { marginTop: 10, borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultTextWrap: { flex: 1, marginRight: 8 },
  resultName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  resultMeta: { fontSize: 13 },
  relationshipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  relationshipChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, minWidth: '45%', alignItems: 'center' },
  relationshipText: { fontSize: 14, fontWeight: '600' },
  pendingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  emptyText: { fontSize: 14 },
  pendingItem: { marginTop: 10, borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  pendingBody: { flex: 1 },
  pendingName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  pendingMeta: { fontSize: 12 },
  cancelBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  cancelText: { fontSize: 12, fontWeight: '700' },
});
