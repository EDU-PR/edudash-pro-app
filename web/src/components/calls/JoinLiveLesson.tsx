'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Video, Users, Clock, ChevronRight, Loader2, Radio, Bell, Sparkles, AlertCircle, RefreshCw, LogIn } from 'lucide-react';
import { GroupCallProvider, useGroupCall } from './GroupCallProvider';
import { ClassLessonCall } from './ClassLessonCall';
import { useRouter } from 'next/navigation';

interface LiveLesson {
  id: string;
  title: string;
  meeting_url: string;
  status: string;
  scheduled_start: string;
  teacher: {
    first_name: string;
    last_name: string;
  } | null;
  classes: {
    name: string;
    grade_level: string;
  } | null;
}

interface JoinLiveLessonProps {
  studentId?: string;
  classId?: string;
  preschoolId: string;
}

function JoinLiveLessonInner({ studentId, classId, preschoolId }: JoinLiveLessonProps) {
  const supabase = createClient();
  const router = useRouter();
  const { isInCall, error: callError, isJoining: isGroupJoining } = useGroupCall();
  
  const [liveLessons, setLiveLessons] = useState<LiveLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<LiveLesson | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [showError, setShowError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Show error from GroupCallProvider
  useEffect(() => {
    if (callError) {
      setShowError(callError);
      setJoiningId(null);
      setActiveLesson(null);
    }
  }, [callError]);

  // Reset joining state when group joining completes
  useEffect(() => {
    if (!isGroupJoining && joiningId && !isInCall && !callError) {
      // Still joining but group call provider not joining - might be stuck
    }
  }, [isGroupJoining, joiningId, isInCall, callError]);

  // Fetch live lessons for this student's class
  useEffect(() => {
    const fetchLiveLessons = async () => {
      setLoading(true);
      
      const now = new Date().toISOString();
      
      // First, clean up any expired calls in this preschool
      try {
        await supabase
          .from('video_calls')
          .update({ status: 'ended', actual_end: now })
          .eq('preschool_id', preschoolId)
          .eq('status', 'live')
          .lt('scheduled_end', now);
      } catch (e) {
        console.warn('[JoinLiveLesson] Cleanup error:', e);
      }
      
      // Only fetch actually LIVE lessons (not scheduled ones that haven't started)
      let query = supabase
        .from('video_calls')
        .select(`
          id,
          title,
          meeting_url,
          status,
          scheduled_start,
          scheduled_end,
          teacher:teacher_id (first_name, last_name),
          classes:class_id (name, grade_level)
        `)
        .eq('preschool_id', preschoolId)
        .eq('status', 'live') // Only show actually live sessions
        .gt('scheduled_end', now) // Only show calls that haven't expired
        .order('scheduled_start', { ascending: true });

      // Filter by class if provided
      if (classId) {
        query = query.eq('class_id', classId);
      }

      const { data, error } = await query;

      if (data) {
        setLiveLessons(data as unknown as LiveLesson[]);
      }
      setLoading(false);
    };

    fetchLiveLessons();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('live-lessons')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_calls',
          filter: `preschool_id=eq.${preschoolId}`,
        },
        () => {
          fetchLiveLessons();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, preschoolId, classId]);

  // Join a lesson
  const handleJoinLesson = (lesson: LiveLesson) => {
    setShowError(null);
    setJoiningId(lesson.id);
    setActiveLesson(lesson);
  };

  // Leave lesson
  const handleLeaveLesson = () => {
    setActiveLesson(null);
    setJoiningId(null);
  };

  // Handle sign in redirect
  const handleSignIn = () => {
    router.push('/auth/signin');
  };

  // Handle session refresh
  const handleRefreshSession = async () => {
    setIsRefreshing(true);
    try {
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        setShowError('Failed to refresh session. Please sign in again.');
      } else {
        setShowError(null);
        // Re-check session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setShowError(null);
        } else {
          setShowError('Session expired. Please sign in again.');
        }
      }
    } catch (e) {
      setShowError('Failed to refresh session.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Show error state
  if (showError) {
    const isAuthError = showError.toLowerCase().includes('sign in') || 
                       showError.toLowerCase().includes('authentication') ||
                       showError.toLowerCase().includes('session') ||
                       showError.toLowerCase().includes('unauthorized');

    return (
      <div style={{
        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        borderRadius: 20,
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 10px 40px rgba(239, 68, 68, 0.3)',
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <AlertCircle style={{ width: 24, height: 24, color: 'white' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'white' }}>
                Unable to Join
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'rgba(255, 255, 255, 0.8)' }}>
                {showError}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {isAuthError && (
              <button
                onClick={handleSignIn}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 20px',
                  background: 'white',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#dc2626',
                  cursor: 'pointer',
                }}
              >
                <LogIn style={{ width: 18, height: 18 }} />
                Sign In
              </button>
            )}
            
            <button
              onClick={handleRefreshSession}
              disabled={isRefreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 20px',
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                color: 'white',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                opacity: isRefreshing ? 0.7 : 1,
              }}
            >
              <RefreshCw style={{ 
                width: 18, 
                height: 18,
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              }} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Session'}
            </button>

            <button
              onClick={() => setShowError(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 20px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                color: 'white',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
        
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Show active lesson call
  if (activeLesson) {
    const teacherName = activeLesson.teacher
      ? `${activeLesson.teacher.first_name} ${activeLesson.teacher.last_name}`.trim()
      : 'Teacher';

    return (
      <ClassLessonCall
        roomUrl={activeLesson.meeting_url}
        lessonTitle={activeLesson.title}
        className={activeLesson.classes?.name}
        teacherName={teacherName}
        isTeacher={false}
        onLeave={handleLeaveLesson}
      />
    );
  }

  if (loading) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)',
        borderRadius: 20,
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 10px 40px rgba(59, 130, 246, 0.3)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 0',
        }}>
          <Loader2 style={{ width: 32, height: 32, color: 'white', animation: 'spin 1s linear infinite' }} />
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Empty state - no live lessons
  if (liveLessons.length === 0) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)',
        borderRadius: 20,
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 10px 40px rgba(59, 130, 246, 0.3)',
      }}>
        {/* Decorative elements */}
        <div style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 150,
          height: 150,
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute',
          bottom: -20,
          left: -20,
          width: 100,
          height: 100,
          background: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '50%',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Video style={{ width: 24, height: 24, color: 'white' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'white' }}>
                Live Lessons
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'rgba(255, 255, 255, 0.8)' }}>
                Join your teacher&apos;s class
              </p>
            </div>
          </div>

          {/* Empty State */}
          <div style={{
            textAlign: 'center',
            padding: '32px 16px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            backdropFilter: 'blur(10px)',
          }}>
            <div style={{
              width: 64,
              height: 64,
              margin: '0 auto 16px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Bell style={{ width: 32, height: 32, color: 'rgba(255, 255, 255, 0.9)' }} />
            </div>
            <h4 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, color: 'white' }}>
              No Live Lessons Right Now
            </h4>
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.5 }}>
              You&apos;ll get a notification when<br />your teacher starts a lesson
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Has live lessons
  return (
    <div style={{
      background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)',
      borderRadius: 20,
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 10px 40px rgba(59, 130, 246, 0.3)',
    }}>
      {/* Decorative elements */}
      <div style={{
        position: 'absolute',
        top: -40,
        right: -40,
        width: 150,
        height: 150,
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '50%',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Video style={{ width: 24, height: 24, color: 'white' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'white' }}>
                Live Lessons
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'rgba(255, 255, 255, 0.8)' }}>
                {liveLessons.length} lesson{liveLessons.length !== 1 ? 's' : ''} available
              </p>
            </div>
          </div>
          
          {/* Live indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'rgba(239, 68, 68, 0.9)',
            borderRadius: 20,
            animation: 'pulse 2s infinite',
          }}>
            <Radio style={{ width: 14, height: 14, color: 'white' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>LIVE NOW</span>
          </div>
        </div>

        {/* Lesson Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {liveLessons.map((lesson) => {
            const teacherName = lesson.teacher
              ? `${lesson.teacher.first_name} ${lesson.teacher.last_name}`.trim()
              : 'Teacher';
            const isLive = lesson.status === 'live';

            return (
              <div
                key={lesson.id}
                style={{
                  padding: 16,
                  background: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: 14,
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      {isLive && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          background: '#fef2f2',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#dc2626',
                        }}>
                          <span style={{
                            width: 6,
                            height: 6,
                            background: '#dc2626',
                            borderRadius: '50%',
                            animation: 'blink 1s infinite',
                          }} />
                          LIVE
                        </span>
                      )}
                      <h4 style={{
                        margin: 0,
                        fontSize: 16,
                        fontWeight: 600,
                        color: '#1f2937',
                      }}>
                        {lesson.title}
                      </h4>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 13,
                      color: '#6b7280',
                    }}>
                      <span>{lesson.classes?.name || 'All Classes'}</span>
                      <span>•</span>
                      <span>{teacherName}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleJoinLesson(lesson)}
                    disabled={joiningId === lesson.id}
                    style={{
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                      border: 'none',
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'white',
                      cursor: joiningId === lesson.id ? 'not-allowed' : 'pointer',
                      opacity: joiningId === lesson.id ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                    }}
                    onMouseEnter={(e) => {
                      if (joiningId !== lesson.id) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                    }}
                  >
                    {joiningId === lesson.id ? (
                      <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <>
                        Join Now
                        <ChevronRight style={{ width: 16, height: 16 }} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

// Wrapper with provider
export function JoinLiveLesson(props: JoinLiveLessonProps) {
  return (
    <GroupCallProvider>
      <JoinLiveLessonInner {...props} />
    </GroupCallProvider>
  );
}
