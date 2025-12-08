'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Clock, CheckCircle, MessageCircle, Megaphone, BookOpen, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface Activity {
  id: string;
  type: 'homework_submitted' | 'homework_graded' | 'message_received' | 'announcement' | 'event';
  title: string;
  description: string;
  timestamp: string;
  link?: string;
  icon: 'homework' | 'message' | 'announcement' | 'success' | 'warning';
}

interface ActivityFeedProps {
  userId: string;
  activeChildId?: string;
  limit?: number;
}

export function ActivityFeed({ userId, activeChildId, limit = 10 }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadActivities();
  }, [userId, activeChildId]);

  const loadActivities = async () => {
    if (!userId) return;
    
    setLoading(true);
    const activities: Activity[] = [];

    try {
      // Get children for the user
      let childQuery = supabase
        .from('students')
        .select('id, first_name, last_name, class_id, preschool_id')
        .eq('parent_id', userId);
      
      if (activeChildId) {
        childQuery = childQuery.eq('id', activeChildId);
      }

      const { data: children } = await childQuery;

      if (children && children.length > 0) {
        const childIds = children.map((c: any) => c.id);
        const preschoolIds = [...new Set(children.map((c: any) => c.preschool_id).filter(Boolean))];

        // Recent homework submissions
        const { data: submissions } = await supabase
          .from('homework_submissions')
          .select(`
            id,
            submitted_at,
            grade,
            feedback,
            student_id,
            assignment:homework_assignments(title)
          `)
          .in('student_id', childIds)
          .order('submitted_at', { ascending: false })
          .limit(5);

        if (submissions) {
          submissions.forEach((sub: any) => {
            const child = children.find((c: any) => c.id === sub.student_id);
            
            if (sub.grade !== null) {
              // Graded homework
              activities.push({
                id: `graded-${sub.id}`,
                type: 'homework_graded',
                title: 'Homework Graded',
                description: `${child?.first_name}'s "${sub.assignment?.title}" received ${sub.grade}%`,
                timestamp: sub.submitted_at,
                link: `/dashboard/parent/homework`,
                icon: sub.grade >= 75 ? 'success' : sub.grade >= 50 ? 'warning' : 'homework',
              });
            } else {
              // Submitted homework
              activities.push({
                id: `submitted-${sub.id}`,
                type: 'homework_submitted',
                title: 'Homework Submitted',
                description: `${child?.first_name} submitted "${sub.assignment?.title}"`,
                timestamp: sub.submitted_at,
                link: `/dashboard/parent/homework`,
                icon: 'homework',
              });
            }
          });
        }

        // Recent messages
        if (preschoolIds.length > 0) {
          const { data: messages } = await supabase
            .from('messages')
            .select('id, subject, created_at, sender_id')
            .in('preschool_id', preschoolIds)
            .eq('recipient_id', userId)
            .order('created_at', { ascending: false })
            .limit(3);

          if (messages) {
            messages.forEach((msg: any) => {
              activities.push({
                id: `message-${msg.id}`,
                type: 'message_received',
                title: 'New Message',
                description: msg.subject || 'No subject',
                timestamp: msg.created_at,
                link: `/dashboard/parent/messages?id=${msg.id}`,
                icon: 'message',
              });
            });
          }

          // Recent announcements
          const { data: announcements } = await supabase
            .from('announcements')
            .select('id, title, published_at, priority')
            .in('preschool_id', preschoolIds)
            .in('target_audience', ['all', 'parents'])
            .eq('is_published', true)
            .order('published_at', { ascending: false })
            .limit(3);

          if (announcements) {
            announcements.forEach((ann: any) => {
              activities.push({
                id: `announcement-${ann.id}`,
                type: 'announcement',
                title: 'School Announcement',
                description: ann.title,
                timestamp: ann.published_at,
                link: `/dashboard/parent/announcements`,
                icon: ann.priority === 'urgent' || ann.priority === 'high' ? 'warning' : 'announcement',
              });
            });
          }
        }
      }

      // Sort all activities by timestamp
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Limit results
      setActivities(activities.slice(0, limit));
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (iconType: string) => {
    switch (iconType) {
      case 'homework':
        return <BookOpen className="icon20" style={{ color: 'var(--primary)' }} />;
      case 'message':
        return <MessageCircle className="icon20" style={{ color: 'var(--info)' }} />;
      case 'announcement':
        return <Megaphone className="icon20" style={{ color: 'var(--primary)' }} />;
      case 'success':
        return <CheckCircle className="icon20" style={{ color: 'var(--success)' }} />;
      case 'warning':
        return <AlertCircle className="icon20" style={{ color: 'var(--warning)' }} />;
      default:
        return <Clock className="icon20" style={{ color: 'var(--textLight)' }} />;
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return time.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center' }}>
        <Clock className="icon48" style={{ margin: '0 auto', color: 'var(--textLight)' }} />
        <h3 style={{ marginTop: 16, fontSize: 16, fontWeight: 600 }}>No recent activity</h3>
        <p style={{ color: 'var(--textLight)', fontSize: 14, marginTop: 8 }}>
          Activity will appear here as you and your child use the platform
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {activities.map((activity) => {
        const content = (
          <div
            className="card"
            style={{
              padding: 16,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              cursor: activity.link ? 'pointer' : 'default',
              transition: 'all 0.2s',
            }}
          >
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: 'var(--surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              {getIcon(activity.icon)}
            </div>
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                  {activity.title}
                </h4>
                <span style={{ fontSize: 12, color: 'var(--textLight)', whiteSpace: 'nowrap' }}>
                  {getTimeAgo(activity.timestamp)}
                </span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--textMuted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activity.description}
              </p>
            </div>
          </div>
        );

        if (activity.link) {
          return (
            <Link key={activity.id} href={activity.link} style={{ textDecoration: 'none', color: 'inherit' }}>
              {content}
            </Link>
          );
        }

        return <div key={activity.id}>{content}</div>;
      })}
    </div>
  );
}
