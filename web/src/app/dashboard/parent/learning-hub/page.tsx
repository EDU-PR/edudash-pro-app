'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { SubPageHeader } from '@/components/dashboard/SubPageHeader';
import {
  Rocket, Lock, Sparkles, Clock, ArrowRight, Play, CheckCircle, RefreshCw, X,
} from 'lucide-react';

interface ActivityStep {
  title: string;
  prompt: string;
  options?: { label: string; correct?: boolean }[];
  confirmOnly?: boolean;
}

interface Activity {
  id: string;
  title: string;
  subtitle: string;
  duration: string;
  gradient: string;
  tags: string[];
  isLesson: boolean;
  requiresTier: 'free' | 'starter' | 'plus';
  aiPrompt?: string;
  steps: ActivityStep[];
}

const TIER_LIMITS: Record<string, { lessons: number; activities: number; aiHints: number }> = {
  free: { lessons: 1, activities: 3, aiHints: 5 },
  starter: { lessons: 3, activities: 8, aiHints: 20 },
  plus: { lessons: Infinity, activities: Infinity, aiHints: Infinity },
};

const ACTIVITIES: Activity[] = [
  {
    id: 'robot_pathfinder',
    title: '🤖 Robot Pathfinder',
    subtitle: 'Guide a robot through a maze using directional commands',
    duration: '5 min',
    gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
    tags: ['Coding', 'Logic', 'Problem Solving'],
    isLesson: true,
    requiresTier: 'free',
    aiPrompt: 'Help me understand how directional commands work for guiding a robot through a maze.',
    steps: [
      { title: 'Choose Direction', prompt: 'Your robot is at START. Which way should it go first?', options: [{ label: '➡️ Right', correct: true }, { label: '⬆️ Up' }, { label: '⬇️ Down' }] },
      { title: 'Continue Path', prompt: 'Great! Now the robot is at a junction. Where next?', options: [{ label: '⬆️ Up', correct: true }, { label: '⬇️ Down' }, { label: '⬅️ Left' }] },
      { title: 'Reach Goal!', prompt: 'Almost there! One more move to reach the flag 🏁', options: [{ label: '➡️ Right', correct: true }, { label: '⬆️ Up' }] },
    ],
  },
  {
    id: 'ai_sound_lab',
    title: '🔊 AI Sound Lab',
    subtitle: 'Explore different sounds and create patterns',
    duration: '4 min',
    gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
    tags: ['Music', 'Patterns', 'Creativity'],
    isLesson: false,
    requiresTier: 'free',
    aiPrompt: 'Help me understand musical patterns and how to create simple sound sequences.',
    steps: [
      { title: 'Pick a Sound', prompt: 'Choose a sound to start your pattern:', options: [{ label: '🥁 Drum' }, { label: '🎹 Piano' }, { label: '🎸 Guitar' }] },
      { title: 'Build Pattern', prompt: 'Now add another sound to make a pattern:', options: [{ label: '🔔 Bell' }, { label: '🎺 Trumpet' }, { label: '🪇 Maracas' }] },
      { title: 'Perform!', prompt: 'Clap along to your pattern! Ready? Clap-clap-pause-clap 👏', confirmOnly: true },
    ],
  },
  {
    id: 'rocket_countdown',
    title: '🚀 Rocket Count-Down',
    subtitle: 'Practice counting backwards to launch a rocket',
    duration: '3 min',
    gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    tags: ['Math', 'Counting', 'Numbers'],
    isLesson: false,
    requiresTier: 'free',
    aiPrompt: 'Help me practice counting backwards from 10.',
    steps: [
      { title: 'Count Down', prompt: 'The rocket is ready! What comes after 10 when counting down?', options: [{ label: '9️⃣ Nine', correct: true }, { label: '8️⃣ Eight' }, { label: '1️⃣1️⃣ Eleven' }] },
      { title: 'Keep Going', prompt: 'Great! Now count: 9, 8, 7, 6... What comes next?', options: [{ label: '5️⃣ Five', correct: true }, { label: '4️⃣ Four' }, { label: '7️⃣ Seven' }] },
      { title: 'Blast Off!', prompt: '3... 2... 1... BLAST OFF! 🚀🌟 Say it out loud!', confirmOnly: true },
    ],
  },
  {
    id: 'build_a_bot',
    title: '🛠️ Build-a-Bot',
    subtitle: 'Design your own robot by choosing parts',
    duration: '5 min',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    tags: ['Design', 'STEM', 'Creativity'],
    isLesson: true,
    requiresTier: 'starter',
    aiPrompt: 'Help me learn about different robot parts and what they do.',
    steps: [
      { title: 'Choose a Head', prompt: 'Every robot needs a head! Pick one:', options: [{ label: '🤖 Square Head' }, { label: '⭕ Round Head' }, { label: '🔺 Triangle Head' }] },
      { title: 'Pick Arms', prompt: 'What kind of arms does your bot need?', options: [{ label: '💪 Strong Arms' }, { label: '🦾 Robot Arms' }, { label: '🙌 Friendly Arms' }] },
      { title: 'Add Superpower', prompt: 'Give your bot a special ability!', options: [{ label: '✈️ Flying' }, { label: '🏋️ Super Strong' }, { label: '🧠 Super Smart' }] },
    ],
  },
];

export default function LearningHubPage() {
  const router = useRouter();
  const supabase = createClient();

  const [activeActivity, setActiveActivity] = useState<Activity | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [completedActivities, setCompletedActivities] = useState<string[]>([]);
  const [userTier, setUserTier] = useState<string>('free');
  const [childName, setChildName] = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get child name
      const { data: child } = await supabase
        .from('students')
        .select('first_name')
        .eq('parent_id', user.id)
        .limit(1)
        .maybeSingle();
      if (child) setChildName(child.first_name);

      // Get tier
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .or(`id.eq.${user.id},auth_user_id.eq.${user.id}`)
        .maybeSingle();
      if (profile?.subscription_tier) setUserTier(profile.subscription_tier);
    };
    init();
  }, []);

  const limits = useMemo(() => TIER_LIMITS[userTier] || TIER_LIMITS.free, [userTier]);

  const handleStartActivity = (activity: Activity) => {
    // Check tier access
    const tierOrder = ['free', 'starter', 'plus'];
    const userTierIdx = tierOrder.indexOf(userTier);
    const requiredIdx = tierOrder.indexOf(activity.requiresTier);
    if (userTierIdx < requiredIdx) {
      if (confirm('This activity requires an upgrade. Would you like to upgrade?')) {
        router.push('/dashboard/parent/upgrade');
      }
      return;
    }
    setActiveActivity(activity);
    setStepIndex(0);
    setSelectedOption(null);
  };

  const handleNextStep = () => {
    if (!activeActivity) return;
    if (stepIndex < activeActivity.steps.length - 1) {
      setStepIndex((s) => s + 1);
      setSelectedOption(null);
    } else {
      // Complete
      setCompletedActivities((prev) => [...prev, activeActivity.id]);
      setActiveActivity(null);
      setStepIndex(0);
      setSelectedOption(null);
    }
  };

  const handleAiHint = () => {
    if (!activeActivity?.aiPrompt) return;
    router.push(`/dashboard/parent/dash-chat?prompt=${encodeURIComponent(activeActivity.aiPrompt)}`);
  };

  const isLocked = (activity: Activity) => {
    const tierOrder = ['free', 'starter', 'plus'];
    return tierOrder.indexOf(userTier) < tierOrder.indexOf(activity.requiresTier);
  };

  return (
    <ParentShell hideHeader={true}>
      <div style={{ margin: 'calc(var(--space-3) * -1) calc(var(--space-2) * -1)', padding: 0 }}>
        <SubPageHeader
          title="Learning Hub"
          subtitle={childName ? `Interactive STEM activities for ${childName}` : 'Interactive STEM activities for early learners'}
          icon={<Rocket size={28} color="white" />}
        />

        <div style={{ width: '100%', padding: 20, maxWidth: 900, margin: '0 auto' }}>
          {/* Info card */}
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>🎓 About Learning Hub</h3>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
              Fun, interactive activities designed for 3–7 year olds. Each activity takes 3–5 minutes and teaches valuable STEM skills through play.
            </p>
          </div>

          {/* Usage card */}
          <div className="card" style={{ padding: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Activities Completed Today</span>
              <span style={{ color: 'var(--muted)', fontSize: 14 }}>
                {completedActivities.length}/{limits.activities === Infinity ? '∞' : limits.activities}
              </span>
            </div>
            <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4, transition: 'width 0.5s', background: 'var(--primary)',
                width: `${Math.min(100, (completedActivities.length / (isFinite(limits.activities) ? limits.activities : 1)) * 100)}%`,
              }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              Current plan: <strong style={{ textTransform: 'capitalize' }}>{userTier}</strong>
            </div>
          </div>

          {/* Activity cards */}
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Interactive Lessons</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {ACTIVITIES.map((activity) => {
              const locked = isLocked(activity);
              const completed = completedActivities.includes(activity.id);
              return (
                <button
                  key={activity.id}
                  onClick={() => handleStartActivity(activity)}
                  style={{
                    textAlign: 'left', border: 'none', cursor: locked ? 'not-allowed' : 'pointer',
                    borderRadius: 18, overflow: 'hidden', opacity: locked ? 0.7 : 1,
                    background: activity.gradient, color: 'white', padding: 20,
                    transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative',
                  }}
                  onMouseEnter={(e) => { if (!locked) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {completed && (
                    <div style={{ position: 'absolute', top: 12, right: 12 }}>
                      <CheckCircle size={22} />
                    </div>
                  )}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{activity.title}</div>
                    <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{activity.subtitle}</div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {activity.tags.map((tag) => (
                      <span key={tag} style={{
                        background: 'rgba(255,255,255,0.2)', padding: '3px 10px',
                        borderRadius: 999, fontSize: 11, fontWeight: 600,
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {locked ? (
                        <>
                          <Lock size={14} />
                          <span style={{ fontSize: 12, fontWeight: 600 }}>Locked</span>
                        </>
                      ) : (
                        <>
                          <Clock size={14} />
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{activity.duration}</span>
                        </>
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {activity.isLesson ? 'Lesson of the day' : 'Quick activity'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Activity Modal */}
      {activeActivity && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--card)', borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24, width: '100%', maxWidth: 500, maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{activeActivity.title}</h3>
              <button onClick={() => { setActiveActivity(null); setStepIndex(0); setSelectedOption(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
              Step {stepIndex + 1} of {activeActivity.steps.length}
            </div>

            {/* Progress bar */}
            <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2, marginBottom: 20, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${((stepIndex + 1) / activeActivity.steps.length) * 100}%`, background: 'var(--primary)', borderRadius: 2, transition: 'width 0.3s' }} />
            </div>

            <h4 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>
              {activeActivity.steps[stepIndex]?.title}
            </h4>
            <p style={{ margin: '0 0 20px', color: 'var(--muted)', lineHeight: 1.5 }}>
              {activeActivity.steps[stepIndex]?.prompt}
            </p>

            {activeActivity.steps[stepIndex]?.options && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                {activeActivity.steps[stepIndex].options!.map((opt, idx) => (
                  <button
                    key={opt.label}
                    onClick={() => setSelectedOption(idx)}
                    style={{
                      padding: '12px 20px', borderRadius: 14, cursor: 'pointer',
                      border: '2px solid',
                      borderColor: selectedOption === idx ? 'var(--primary)' : 'var(--border)',
                      background: selectedOption === idx ? 'var(--primary)' : 'var(--surface)',
                      color: selectedOption === idx ? 'white' : 'var(--text)',
                      fontWeight: 600, fontSize: 15, transition: 'all 0.2s',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              {activeActivity.aiPrompt && (
                <button
                  onClick={handleAiHint}
                  style={{
                    flex: 1, padding: '12px 16px', borderRadius: 14, border: 'none',
                    background: 'linear-gradient(135deg, #7c3aed, #ec4899)', color: 'white',
                    fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <Sparkles size={16} /> Ask Dash AI
                </button>
              )}
              <button
                onClick={handleNextStep}
                disabled={!activeActivity.steps[stepIndex]?.confirmOnly && selectedOption === null}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 14, border: 'none',
                  background: 'var(--success)', color: 'white', fontWeight: 700, fontSize: 15,
                  cursor: (!activeActivity.steps[stepIndex]?.confirmOnly && selectedOption === null) ? 'not-allowed' : 'pointer',
                  opacity: (!activeActivity.steps[stepIndex]?.confirmOnly && selectedOption === null) ? 0.5 : 1,
                }}
              >
                {stepIndex === activeActivity.steps.length - 1 ? 'Complete 🎉' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ParentShell>
  );
}
