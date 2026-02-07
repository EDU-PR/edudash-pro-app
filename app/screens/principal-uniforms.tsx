import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';

interface ParentProfile {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface UniformRow {
  id: string;
  child_name: string;
  age_years: number;
  tshirt_size: string;
  tshirt_quantity?: number | null;
  shorts_quantity?: number | null;
  tshirt_number?: string | null;
  is_returning?: boolean | null;
  sample_supplied?: boolean | null;
  created_at: string;
  updated_at?: string | null;
  student_id: string;
  student?: {
    first_name?: string | null;
    last_name?: string | null;
    student_id?: string | null;
  } | null;
  parent?: ParentProfile | null;
}

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  student_id?: string | null;
  class_id?: string | null;
  classroom?: {
    id?: string | null;
    name?: string | null;
  } | null;
  parent?: ParentProfile | null;
  guardian?: ParentProfile | null;
}

interface DisplayRow {
  id: string;
  studentId: string;
  childName: string;
  ageYears: number | null;
  tshirtSize: string;
  tshirtQuantity: number | null;
  shortsQuantity: number | null;
  tshirtNumber: string;
  isReturning: boolean;
  sampleSupplied: boolean;
  studentCode: string;
  parentId: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  submittedAt: string | null;
  updatedAt: string | null;
  status: 'submitted' | 'missing';
  className: string;
  paymentStatus: 'paid' | 'pending' | 'unpaid';
}

const SIZE_OPTIONS = [
  '2-3',
  '3-4',
  '4-5',
  '5-6',
  '6-7',
  '7-8',
  '8-9',
  '9-10',
  '10-11',
  '11-12',
  '12-13',
  'XS',
  'S',
  'M',
  'L',
  'XL',
];

const escapeHtml = (value: string | number | null | undefined) => {
  const stringValue = value === null || value === undefined ? '' : String(value);
  return stringValue
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatName = (first?: string | null, last?: string | null) =>
  `${first || ''} ${last || ''}`.trim();

const resolveParentProfile = (student?: StudentRow | null, override?: ParentProfile | null) =>
  override || student?.parent || student?.guardian || null;

const isUniformLabel = (value?: string | null) => (value || '').toLowerCase().includes('uniform');
const isUniformPaymentRecord = (payment: any) =>
  isUniformLabel(payment?.description) ||
  isUniformLabel(payment?.metadata?.payment_purpose) ||
  String(payment?.metadata?.payment_context || '').toLowerCase() === 'uniform' ||
  String(payment?.metadata?.fee_type || '').toLowerCase() === 'uniform';

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
  const [showInsights, setShowInsights] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [bulkMessaging, setBulkMessaging] = useState<null | 'missing' | 'unpaid'>(null);
  const [paymentStatusByStudent, setPaymentStatusByStudent] = useState<Map<string, 'paid' | 'pending' | 'unpaid'>>(
    () => new Map()
  );

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

      const studentIds = (studentData as any[] | null)?.map((s) => s.id).filter(Boolean) || [];
      if (studentIds.length) {
        const [{ data: popData }, { data: paymentsData }] = await Promise.all([
          supabase
            .from('pop_uploads')
            .select('student_id, status, description, title')
            .eq('preschool_id', schoolId)
            .eq('upload_type', 'proof_of_payment')
            .in('student_id', studentIds),
          supabase
            .from('payments')
            .select('student_id, status, description, metadata')
            .eq('preschool_id', schoolId)
            .in('student_id', studentIds),
        ]);

        const nextMap = new Map<string, 'paid' | 'pending' | 'unpaid'>();
        studentIds.forEach((id) => nextMap.set(id, 'unpaid'));

        (popData || [])
          .filter((pop: any) => isUniformLabel(pop?.description) || isUniformLabel(pop?.title))
          .forEach((pop: any) => {
          const current = nextMap.get(pop.student_id) || 'unpaid';
          if (pop.status === 'approved') {
            nextMap.set(pop.student_id, 'paid');
            return;
          }
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
      console.error('Load uniform sizes failed', e);
      showAlert({
        title: 'Error',
        message: e?.message || 'Failed to load uniform sizes',
        buttons: [{ text: 'OK' }],
      });
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

  const studentLookup = useMemo(() => {
    const map = new Map<string, StudentRow>();
    students.forEach((student) => map.set(student.id, student));
    return map;
  }, [students]);

  const submittedStudentIds = useMemo(() => new Set(rows.map((row) => row.student_id)), [rows]);

  const missingStudents = useMemo(
    () => students.filter((student) => !submittedStudentIds.has(student.id)),
    [students, submittedStudentIds]
  );

  const submittedRows: DisplayRow[] = useMemo(() => rows.map((row) => {
    const student = studentLookup.get(row.student_id);
    const parentProfile = resolveParentProfile(student, row.parent || null);
    const childName = row.child_name || formatName(row.student?.first_name, row.student?.last_name) || formatName(student?.first_name, student?.last_name);
    const parentName = formatName(parentProfile?.first_name, parentProfile?.last_name) || parentProfile?.email || '';
    return {
      id: row.id,
      studentId: row.student_id,
      childName: childName || 'Unnamed Child',
      ageYears: row.age_years,
      tshirtSize: row.tshirt_size,
      tshirtQuantity: row.tshirt_quantity ?? 0,
      shortsQuantity: row.shorts_quantity ?? 0,
      tshirtNumber: row.tshirt_number || '',
      isReturning: Boolean(row.is_returning),
      sampleSupplied: Boolean(row.sample_supplied),
      studentCode: row.student?.student_id || student?.student_id || '',
      parentId: parentProfile?.id || '',
      parentName,
      parentEmail: parentProfile?.email || '',
      parentPhone: parentProfile?.phone || '',
      submittedAt: row.created_at,
      updatedAt: row.updated_at || null,
      status: 'submitted' as const,
      className: student?.classroom?.name || 'Unassigned',
      paymentStatus: paymentStatusByStudent.get(row.student_id) || 'unpaid',
    };
  }), [rows, studentLookup, paymentStatusByStudent]);

  const missingRows: DisplayRow[] = useMemo(() => missingStudents.map((student) => {
    const parentProfile = resolveParentProfile(student, null);
    const parentName = formatName(parentProfile?.first_name, parentProfile?.last_name) || parentProfile?.email || '';
    return {
      id: student.id,
      studentId: student.id,
      childName: formatName(student.first_name, student.last_name) || 'Unnamed Child',
      ageYears: null,
      tshirtSize: '',
      tshirtQuantity: null,
      shortsQuantity: null,
      tshirtNumber: '',
      isReturning: false,
      sampleSupplied: false,
      studentCode: student.student_id || '',
      parentId: parentProfile?.id || '',
      parentName,
      parentEmail: parentProfile?.email || '',
      parentPhone: parentProfile?.phone || '',
      submittedAt: null,
      updatedAt: null,
      status: 'missing' as const,
      className: student.classroom?.name || 'Unassigned',
      paymentStatus: paymentStatusByStudent.get(student.id) || 'unpaid',
    };
  }), [missingStudents, paymentStatusByStudent]);

  const submittedCount = submittedRows.length;
  const missingCount = missingRows.length;
  const missingContactableCount = useMemo(() => missingRows.filter((row) => row.parentId).length, [missingRows]);
  const unpaidContactableCount = useMemo(
    () => submittedRows.filter((row) => row.paymentStatus === 'unpaid' && row.parentId).length,
    [submittedRows]
  );

  const displayRows: DisplayRow[] = useMemo(() => (
    statusFilter === 'submitted'
      ? submittedRows
      : statusFilter === 'missing'
        ? missingRows
        : [...submittedRows, ...missingRows]
  ), [missingRows, submittedRows, statusFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return displayRows.filter((row) => {
      const matchesSearch = !q || [
        row.childName,
        row.studentCode,
        row.parentName,
        row.parentEmail,
        row.parentPhone,
        row.className,
      ].some((field) => field.toLowerCase().includes(q));
      const matchesSize = sizeFilter === 'all' || row.tshirtSize === sizeFilter || row.status === 'missing';
      return matchesSearch && matchesSize;
    });
  }, [displayRows, search, sizeFilter]);

  const sizeSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    rows.forEach((row) => {
      if (!row.tshirt_size) return;
      summary[row.tshirt_size] = (summary[row.tshirt_size] || 0) + 1;
    });
    return summary;
  }, [rows]);

  const missingByClass = useMemo(() => {
    const summary: Record<string, number> = {};
    missingStudents.forEach((student) => {
      const className = student.classroom?.name || 'Unassigned';
      summary[className] = (summary[className] || 0) + 1;
    });
    return Object.entries(summary)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [missingStudents]);

  const exportPdf = useCallback(async () => {
    if (!filtered.length) {
      showAlert({
        title: 'Nothing to export',
        message: 'No uniform records to export.',
        buttons: [{ text: 'OK' }],
      });
      return;
    }
    setExporting(true);
    try {
      const generatedAt = new Date().toLocaleString('en-ZA');
      const sizeSummaryRows = Object.entries(sizeSummary)
        .map(([size, count]) => `<span class="chip"><span>${escapeHtml(size)}</span><strong>${count}</strong></span>`)
        .join('');
      const missingClassRows = missingByClass
        .map(({ name, count }) => `<span class="chip"><span>${escapeHtml(name)}</span><strong>${count}</strong></span>`)
        .join('');

      const htmlRows = filtered.map((row, index) => {
        const updated = row.updatedAt || row.submittedAt;
        const updatedText = updated ? new Date(updated).toLocaleDateString('en-ZA') : '-';
        const firstName = row.childName.split(' ')[0] || row.childName;
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(firstName)}</td>
            <td>${escapeHtml(row.className)}</td>
            <td>${escapeHtml(row.ageYears ?? '-')}</td>
            <td>${escapeHtml(row.tshirtSize || '-')}</td>
            <td>${escapeHtml(row.tshirtQuantity ?? '-')}</td>
            <td>${escapeHtml(row.shortsQuantity ?? '-')}</td>
            <td>${row.isReturning ? 'Yes' : 'No'}</td>
            <td>${escapeHtml(row.tshirtNumber || '-')}</td>
            <td>${row.sampleSupplied ? 'Yes' : 'No'}</td>
            <td>${escapeHtml(row.studentCode || '-')}</td>
            <td>${escapeHtml(row.parentName || '-')}</td>
            <td>${escapeHtml(updatedText)}</td>
            <td>${escapeHtml(row.status)}</td>
            <td>${escapeHtml(row.paymentStatus)}</td>
          </tr>
        `;
      }).join('');

      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              @page { size: A4; margin: 20mm; }
              body { font-family: Arial, sans-serif; color: #111827; }
              h1 { font-size: 20px; margin: 0 0 4px; }
              .subtitle { font-size: 12px; color: #6b7280; margin-bottom: 16px; }
              .section { margin-bottom: 16px; }
              .chips { display: flex; flex-wrap: wrap; gap: 6px; }
              .chip { display: inline-flex; gap: 6px; align-items: center; padding: 4px 8px; border-radius: 999px; background: #f3f4f6; font-size: 11px; }
              .chip strong { font-size: 11px; color: #111827; }
              table { width: 100%; border-collapse: collapse; font-size: 11px; }
              th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; vertical-align: top; }
              th { background: #f9fafb; font-weight: 700; }
              thead { display: table-header-group; }
              .footer { margin-top: 16px; font-size: 10px; color: #6b7280; text-align: right; }
            </style>
          </head>
          <body>
            <h1>Uniform Sizes</h1>
            <div class="subtitle">Generated ${escapeHtml(generatedAt)}</div>

            <div class="section">
              <div style="font-weight: 700; font-size: 12px; margin-bottom: 6px;">Size Summary</div>
              <div class="chips">${sizeSummaryRows || '<span class="chip">No submissions yet</span>'}</div>
            </div>

            <div class="section">
              <div style="font-weight: 700; font-size: 12px; margin-bottom: 6px;">Missing by Class</div>
              <div class="chips">${missingClassRows || '<span class="chip">No missing submissions</span>'}</div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Child</th>
                  <th>Class</th>
                  <th>Age</th>
                  <th>Size</th>
                  <th># T-shirt</th>
                  <th># Shorts</th>
                  <th>Returning</th>
                  <th>Back #</th>
                  <th>Sample</th>
                  <th>Student Code</th>
                  <th>Submitted By</th>
                  <th>Last Updated</th>
                  <th>Status</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                ${htmlRows}
              </tbody>
            </table>

            <div class="footer">EduDash Pro • Uniform Sizes</div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Export uniform sizes (PDF)',
          UTI: 'com.adobe.pdf',
        });
      } else {
        showAlert({
          title: 'PDF Generated',
          message: 'The uniform sizes PDF has been generated.',
          buttons: [{ text: 'OK' }],
        });
      }
    } catch (e: any) {
      console.error('Export PDF failed', e);
      showAlert({
        title: 'Export Error',
        message: e?.message || 'Failed to export PDF',
        buttons: [{ text: 'OK' }],
      });
    } finally {
      setExporting(false);
    }
  }, [filtered, missingByClass, showAlert, sizeSummary]);

  const paymentStatusMeta = useCallback((status: DisplayRow['paymentStatus']) => {
    if (status === 'paid') {
      return { label: 'Paid', bg: theme.success + '22', border: theme.success + '55', text: theme.success };
    }
    if (status === 'pending') {
      return { label: 'Pending', bg: theme.warning + '22', border: theme.warning + '55', text: theme.warning };
    }
    return { label: 'Unpaid', bg: theme.error + '22', border: theme.error + '55', text: theme.error };
  }, [theme]);

  const getOrCreateParentPrincipalThread = useCallback(async (payload: { studentId: string; parentId: string; subject: string }) => {
    if (!user?.id || !schoolId) return null;
    const supabase = assertSupabase();

    const { data } = await supabase
      .from('message_threads')
      .select('id, message_participants(user_id, role)')
      .eq('preschool_id', schoolId)
      .eq('type', 'parent-principal')
      .eq('student_id', payload.studentId);

    const threads = (data as any[] | null) || [];
    const existing = threads.find((thread) => {
      const participants = (thread.message_participants || []) as Array<{ user_id: string }>;
      const ids = new Set(participants.map((p) => p.user_id));
      return ids.has(payload.parentId) && ids.has(user.id);
    });

    if (existing?.id) return existing.id as string;

    const { data: createdThread, error: threadError } = await supabase
      .from('message_threads')
      .insert({
        preschool_id: schoolId,
        created_by: user.id,
        subject: payload.subject,
        type: 'parent-principal',
        student_id: payload.studentId,
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (threadError) throw threadError;
    const threadId = createdThread?.id as string;

    const { error: participantsError } = await supabase.from('message_participants').insert([
      { thread_id: threadId, user_id: user.id, role: 'principal' },
      { thread_id: threadId, user_id: payload.parentId, role: 'parent' },
    ]);

    if (participantsError) throw participantsError;
    return threadId;
  }, [schoolId, user?.id]);

  const sendMessagePushNotification = useCallback(async (params: {
    threadId: string;
    messageId: string;
    senderId: string;
    senderName: string;
    messageContent: string;
    recipientIds: string[];
  }) => {
    const { threadId, messageId, senderId, senderName, messageContent, recipientIds } = params;
    const recipientsExcludingSender = recipientIds.filter((id) => id && id !== senderId);
    if (!recipientsExcludingSender.length) return;

    try {
      const supabase = assertSupabase();
      const { data: sessionResult } = await supabase.auth.getSession();
      const accessToken = sessionResult?.session?.access_token;
      if (!accessToken) return;

      const truncatedBody = messageContent.length > 100
        ? `${messageContent.substring(0, 97)}...`
        : messageContent;

      await supabase.functions.invoke('notifications-dispatcher', {
        body: {
          event_type: 'new_message',
          user_ids: recipientsExcludingSender,
          thread_id: threadId,
          message_id: messageId,
          send_immediately: true,
          template_override: {
            title: `💬 ${senderName}`,
            body: truncatedBody,
            data: {
              type: 'message',
              thread_id: threadId,
              message_id: messageId,
              sender_id: senderId,
              sender_name: senderName,
              screen: 'messages',
            },
          },
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch (err) {
      // Notification failures should not block message sending.
      console.warn('[PrincipalUniforms] Push notification failed:', err);
    }
  }, []);

  const bulkMessageMissing = useCallback(async () => {
    if (!user?.id || !schoolId) return;
    if (bulkMessaging) return;

    const targets = missingRows.filter((row) => row.parentId);
    if (!targets.length) {
      showAlert({
        title: 'No Parents Found',
        message: 'No missing uniform submissions have a linked parent contact.',
        type: 'warning',
        buttons: [{ text: 'OK' }],
      });
      return;
    }

    showAlert({
      title: 'Message Missing Sizes',
      message: `Send an in-app message to ${targets.length} parent(s) who have not submitted uniform sizes yet?`,
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setBulkMessaging('missing');
            const supabase = assertSupabase();
            const senderName =
              (profile as any)?.full_name ||
              `${(profile as any)?.first_name || ''} ${(profile as any)?.last_name || ''}`.trim() ||
              'School';

            let sent = 0;
            let failed = 0;

            for (const row of targets) {
              try {
                const parentLabel = row.parentName || 'Parent';
                const studentCodeLine = row.studentCode ? ` Student code: ${row.studentCode}.` : '';
                const content = `Hi ${parentLabel}, please submit ${row.childName}'s uniform size and quantities in the app.${studentCodeLine} Thank you.`;
                const subject = `Uniform Reminder • ${row.childName}`.trim();
                const threadId = await getOrCreateParentPrincipalThread({
                  studentId: row.studentId,
                  parentId: row.parentId,
                  subject,
                });
                if (!threadId) {
                  failed++;
                  continue;
                }

                const { data: messageData, error: messageError } = await supabase
                  .from('messages')
                  .insert({
                    thread_id: threadId,
                    sender_id: user.id,
                    content,
                    content_type: 'text',
                  })
                  .select('id, content')
                  .single();
                if (messageError) throw messageError;

                await sendMessagePushNotification({
                  threadId,
                  messageId: messageData.id,
                  senderId: user.id,
                  senderName,
                  messageContent: messageData.content,
                  recipientIds: [row.parentId],
                });

                sent++;
              } catch (err) {
                console.warn('[PrincipalUniforms] Bulk message (missing) failed:', err);
                failed++;
              }
            }

            setBulkMessaging(null);
            showAlert({
              title: 'Bulk Message Complete',
              message: failed
                ? `Sent ${sent} message(s). Failed: ${failed}.`
                : `Sent ${sent} message(s).`,
              type: failed ? 'warning' : 'success',
              buttons: [{ text: 'OK' }],
            });
          },
        },
      ],
    });
  }, [bulkMessaging, getOrCreateParentPrincipalThread, missingRows, profile, schoolId, sendMessagePushNotification, showAlert, user?.id]);

  const bulkMessageUnpaid = useCallback(async () => {
    if (!user?.id || !schoolId) return;
    if (bulkMessaging) return;

    const targets = submittedRows.filter((row) => row.paymentStatus === 'unpaid' && row.parentId);
    if (!targets.length) {
      showAlert({
        title: 'No Unpaid Orders',
        message: 'There are no unpaid uniform orders with a linked parent contact.',
        type: 'info',
        buttons: [{ text: 'OK' }],
      });
      return;
    }

    showAlert({
      title: 'Message Unpaid Uniform Orders',
      message: `Send an in-app payment reminder to ${targets.length} parent(s) with unpaid uniform orders?`,
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setBulkMessaging('unpaid');
            const supabase = assertSupabase();
            const senderName =
              (profile as any)?.full_name ||
              `${(profile as any)?.first_name || ''} ${(profile as any)?.last_name || ''}`.trim() ||
              'School';

            let sent = 0;
            let failed = 0;

            for (const row of targets) {
              try {
                const parentLabel = row.parentName || 'Parent';
                const studentCodeLine = row.studentCode ? ` Student code: ${row.studentCode}.` : '';
                const content = `Hi ${parentLabel}, please complete uniform payment (or upload proof of payment) for ${row.childName}'s uniform order in the app.${studentCodeLine} Thank you.`;
                const subject = `Uniform Payment • ${row.childName}`.trim();
                const threadId = await getOrCreateParentPrincipalThread({
                  studentId: row.studentId,
                  parentId: row.parentId,
                  subject,
                });
                if (!threadId) {
                  failed++;
                  continue;
                }

                const { data: messageData, error: messageError } = await supabase
                  .from('messages')
                  .insert({
                    thread_id: threadId,
                    sender_id: user.id,
                    content,
                    content_type: 'text',
                  })
                  .select('id, content')
                  .single();
                if (messageError) throw messageError;

                await sendMessagePushNotification({
                  threadId,
                  messageId: messageData.id,
                  senderId: user.id,
                  senderName,
                  messageContent: messageData.content,
                  recipientIds: [row.parentId],
                });

                sent++;
              } catch (err) {
                console.warn('[PrincipalUniforms] Bulk message (unpaid) failed:', err);
                failed++;
              }
            }

            setBulkMessaging(null);
            showAlert({
              title: 'Bulk Message Complete',
              message: failed
                ? `Sent ${sent} message(s). Failed: ${failed}.`
                : `Sent ${sent} message(s).`,
              type: failed ? 'warning' : 'success',
              buttons: [{ text: 'OK' }],
            });
          },
        },
      ],
    });
  }, [bulkMessaging, getOrCreateParentPrincipalThread, profile, schoolId, showAlert, submittedRows, sendMessagePushNotification, user?.id]);

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
              style={[styles.exportButton, { backgroundColor: theme.primary }]}
              onPress={exportPdf}
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
              onPress={bulkMessageMissing}
              disabled={bulkMessaging !== null || missingContactableCount === 0}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={16} color="#fff" />
              <Text style={styles.bulkButtonText}>
                {bulkMessaging === 'missing' ? 'Sending...' : `Message Missing (${missingContactableCount})`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkButton, { backgroundColor: theme.error || '#ef4444' }]}
              onPress={bulkMessageUnpaid}
              disabled={bulkMessaging !== null || unpaidContactableCount === 0}
            >
              <Ionicons name="cash-outline" size={16} color="#fff" />
              <Text style={styles.bulkButtonText}>
                {bulkMessaging === 'unpaid' ? 'Sending...' : `Message Unpaid (${unpaidContactableCount})`}
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
                Size: {sizeFilter === 'all' ? 'All' : sizeFilter} • Status: {statusFilter === 'all' ? 'All' : statusFilter}
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
                    {SIZE_OPTIONS.map((size) => (
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
                    {missingByClass.map(({ name, count }) => (
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
                    <View
                      style={[
                        styles.paymentChip,
                        {
                          backgroundColor: paymentStatusMeta(item.paymentStatus).bg,
                          borderColor: paymentStatusMeta(item.paymentStatus).border,
                        },
                      ]}
                    >
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
                    {item.tshirtNumber ? <Text style={styles.text}>T-shirt Number: {item.tshirtNumber}</Text> : null}
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
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme?.surface || '#111827',
    borderWidth: 1,
    borderColor: theme?.border || '#1f2937',
  },
  countChipText: { color: theme?.text || '#fff', fontSize: 12, fontWeight: '600' },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  bulkButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  controlsSpacer: { flexGrow: 1 },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme?.border || '#1f2937',
    backgroundColor: theme?.surface || '#111827',
  },
  toggleButtonActive: {
    backgroundColor: theme?.primary || '#3b82f6',
    borderColor: theme?.primary || '#3b82f6',
  },
  toggleButtonText: { color: theme?.textSecondary || '#9CA3AF', fontSize: 12, fontWeight: '700' },
  toggleButtonTextActive: { color: '#fff' },
  filterSummaryRow: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  filterSummaryText: { color: theme?.textSecondary || '#9CA3AF', fontSize: 12, fontWeight: '600' },
  filtersCard: {
    backgroundColor: theme?.cardBackground || '#111827',
    borderRadius: 12,
    padding: 10,
    borderColor: theme?.border || '#1f2937',
    borderWidth: 1,
    marginBottom: 8,
  },
  insightsCard: {
    backgroundColor: theme?.cardBackground || '#111827',
    borderRadius: 12,
    padding: 10,
    borderColor: theme?.border || '#1f2937',
    borderWidth: 1,
    marginBottom: 8,
  },
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
  paymentChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  paymentChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  text: { color: theme?.text || '#fff', fontSize: 13 },
  messageButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme?.primary || '#3b82f6',
  },
  messageButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  muted: { color: theme?.textSecondary || '#9CA3AF', paddingVertical: 8, fontSize: 12 },
});
