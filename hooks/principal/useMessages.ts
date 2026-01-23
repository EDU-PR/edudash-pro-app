// Hook for Principal Messages data and operations

import { useState, useEffect, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { toast } from '@/components/ui/ToastProvider';
import { track } from '@/lib/analytics';
import type { 
  RecipientType, 
  ClassOption, 
  MessageHistory, 
  RecipientCounts 
} from '@/components/principal/messages/types';

interface UseMessagesOptions {
  organizationId: string | null | undefined;
}

export function useMessages({ organizationId }: UseMessagesOptions) {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [messageHistory, setMessageHistory] = useState<MessageHistory[]>([]);
  const [recipientCounts, setRecipientCounts] = useState<RecipientCounts>({
    parents: 0,
    teachers: 0,
    staff: 0,
  });
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    
    setLoadingCounts(true);
    try {
      const supabase = assertSupabase();

      // Count parents (unique guardians)
      const { count: parentCount } = await supabase
        .from('students')
        .select('guardian_id', { count: 'exact', head: true })
        .eq('preschool_id', organizationId)
        .not('guardian_id', 'is', null);

      // Count teachers
      const { count: teacherCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('preschool_id', organizationId)
        .eq('role', 'teacher');

      // Count all staff
      const { count: staffCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('preschool_id', organizationId)
        .in('role', ['teacher', 'admin', 'principal', 'assistant']);

      setRecipientCounts({
        parents: parentCount || 0,
        teachers: teacherCount || 0,
        staff: staffCount || 0,
      });

      // Load classes
      const { data: classData } = await supabase
        .from('classes')
        .select('id, name')
        .eq('preschool_id', organizationId)
        .eq('active', true)
        .order('name');

      setClasses(classData || []);

      // Load recent messages
      const { data: historyData } = await supabase
        .from('teacher_messages')
        .select('id, subject, message, class_id, sent_at, created_at, classes!teacher_messages_class_id_fkey(name)')
        .eq('preschool_id', organizationId)
        .order('sent_at', { ascending: false })
        .limit(10);

      const mapped = (historyData || []).map((m: any) => ({
        id: m.id,
        subject: m.subject,
        message: m.message,
        recipient_type: m.class_id ? 'class' : 'all_parents',
        class_id: m.class_id,
        class_name: m.classes?.name,
        sent_at: m.sent_at || m.created_at,
      }));
      setMessageHistory(mapped);

    } catch (e: any) {
      console.error('Failed to load data:', e);
    } finally {
      setLoadingCounts(false);
      setRefreshing(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      loadData();
    }
  }, [organizationId, loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const sendMessage = useCallback(async (
    recipientType: RecipientType,
    selectedClass: string | null,
    subject: string,
    message: string
  ): Promise<boolean> => {
    if (!organizationId) {
      toast.warn('Your account is not linked to a school.', 'Not Connected');
      return false;
    }
    if (!subject.trim()) {
      toast.warn('Please enter a subject.', 'Subject Required');
      return false;
    }
    if (!message.trim()) {
      toast.warn('Please write a message.', 'Message Required');
      return false;
    }
    if (recipientType === 'class' && !selectedClass) {
      toast.warn('Please select a class.', 'Class Required');
      return false;
    }

    setSending(true);
    try {
      const supabase = assertSupabase();
      const { data: authUser } = await supabase.auth.getUser();
      const userId = authUser?.user?.id;

      if (recipientType === 'class') {
        const { error } = await supabase.from('teacher_messages').insert({
          class_id: selectedClass,
          subject,
          message,
          teacher_id: userId,
          preschool_id: organizationId,
          created_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('announcements').insert({
          title: subject,
          content: message,
          preschool_id: organizationId,
          created_by: userId,
          target_audience: recipientType === 'all_parents' ? 'parents' 
                         : recipientType === 'all_teachers' ? 'teachers' 
                         : 'all',
          is_active: true,
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
      }

      track('edudash.principal.message_sent', { 
        recipientType, 
        classId: selectedClass,
        subjectLength: subject.length,
        messageLength: message.length 
      });

      toast.success('Message sent successfully!', 'Sent');
      loadData();
      return true;
    } catch (e: any) {
      toast.error(e?.message || 'Could not send message.', 'Failed');
      return false;
    } finally {
      setSending(false);
    }
  }, [organizationId, loadData]);

  return {
    classes,
    messageHistory,
    recipientCounts,
    loadingCounts,
    refreshing,
    sending,
    onRefresh,
    sendMessage,
  };
}
