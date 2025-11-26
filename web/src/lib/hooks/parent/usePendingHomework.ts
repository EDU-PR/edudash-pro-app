import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface PendingHomework {
  id: string;
  title: string;
  due_date: string;
  subject: string;
  class_name: string;
  student_name: string;
}

export function usePendingHomework(userId: string | undefined) {
  const [pendingHomework, setPendingHomework] = useState<PendingHomework[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchPendingHomework = async () => {
      try {
        setLoading(true);
        
        // Get parent's children
        const { data: children, error: childrenError } = await supabase
          .from('students')
          .select('id, first_name, last_name, class_id')
          .eq('parent_id', userId);

        if (childrenError) throw childrenError;
        if (!children || children.length === 0) {
          setPendingHomework([]);
          setLoading(false);
          return;
        }

        const studentIds = children.map((c: any) => c.id);

        // Get pending homework for all children
        const { data: homework, error: homeworkError } = await supabase
          .from('homework_assignments')
          .select(`
            id,
            title,
            due_date,
            subject,
            class:classes(name),
            submissions:homework_submissions(id, status)
          `)
          .in('class_id', children.map((c: any) => c.class_id))
          .gte('due_date', new Date().toISOString())
          .order('due_date', { ascending: true });

        if (homeworkError) throw homeworkError;

        // Filter to only show homework without submissions from these students
        const pending = homework?.filter((hw: any) => {
          const submissions = hw.submissions || [];
          // Check if any of the parent's children have submitted
          return !submissions.some((sub: any) => 
            studentIds.includes(sub.student_id) && sub.status !== 'draft'
          );
        }).map((hw: any) => ({
          id: hw.id,
          title: hw.title,
          due_date: hw.due_date,
          subject: hw.subject || 'General',
          class_name: hw.class?.name || 'Unknown',
          student_name: children[0]?.first_name || 'Child'
        })) || [];

        setPendingHomework(pending);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching pending homework:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingHomework();

    // Subscribe to homework changes
    const channel = supabase
      .channel('pending-homework-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'homework_assignments' }, 
        () => fetchPendingHomework()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'homework_submissions' }, 
        () => fetchPendingHomework()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  return { pendingHomework, loading, error, count: pendingHomework.length };
}
