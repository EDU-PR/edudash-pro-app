'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Bot,
  ClipboardCheck,
  Loader2,
  MessageSquare,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';

interface AssistantAction {
  title: string;
  description: string;
  href: string;
  icon: typeof Sparkles;
  accent: string;
}

const ACTIONS: AssistantAction[] = [
  {
    title: 'Open Dash Chat',
    description: 'Ask Dash anything about lesson ideas, parent comms, and class planning.',
    href: '/dashboard/teacher/dash-chat',
    icon: MessageSquare,
    accent: '#8B5CF6',
  },
  {
    title: 'Create AI Lesson',
    description: 'Jump straight into lesson generation with the quick-create flow.',
    href: '/dashboard/teacher/lessons/create?mode=quick',
    icon: BookOpen,
    accent: '#0EA5E9',
  },
  {
    title: 'Open Homework Grader',
    description: 'Review and grade learner submissions with AI-assisted suggestions.',
    href: '/dashboard/teacher/ai-grader',
    icon: ClipboardCheck,
    accent: '#10B981',
  },
];

const QUICK_PROMPTS = [
  'Create a 30-minute numeracy lesson for Grade R with 3 hands-on activities.',
  'Draft a warm parent update about today’s literacy progress and next steps.',
  'Give me 5 low-prep classroom games for rainy day indoor movement.',
];

export default function TeacherAIAssistantPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  const [promptDraft, setPromptDraft] = useState(QUICK_PROMPTS[0]);
  const [copyMessage, setCopyMessage] = useState('');

  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);

  useEffect(() => {
    const initAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/sign-in');
        return;
      }

      setUserId(user.id);
      setAuthLoading(false);
    };

    void initAuth();
  }, [router, supabase]);

  const handleCopyPrompt = async () => {
    const trimmed = promptDraft.trim();
    if (!trimmed) {
      setCopyMessage('Enter a prompt first.');
      return;
    }

    try {
      await navigator.clipboard.writeText(trimmed);
      setCopyMessage('Prompt copied. Paste it in Dash Chat.');
    } catch {
      setCopyMessage('Copy failed. Select the text manually.');
    }
  };

  const handleOpenDashChat = () => {
    const trimmed = promptDraft.trim();
    if (!trimmed) {
      router.push('/dashboard/teacher/dash-chat');
      return;
    }

    router.push(`/dashboard/teacher/dash-chat?prompt=${encodeURIComponent(trimmed)}`);
  };

  const loading = authLoading || profileLoading;
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <TeacherShell
      tenantSlug={tenantSlug}
      userEmail={profile?.email}
      userName={profile?.firstName}
      preschoolName={profile?.preschoolName}
      hideHeader={true}
    >
      <div className="container">
        <div className="section">
          <div className="card p-md border border-purple-500/30 bg-gradient-to-r from-purple-900/30 to-blue-900/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center">
                <Bot className="w-6 h-6 text-purple-200" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">AI Assistant</h1>
                <p className="text-sm text-gray-300">
                  Plan lessons faster and keep communication polished across your classroom.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-purple-100/90">
              <span className="px-3 py-1 rounded-full bg-purple-600/30 border border-purple-500/30">Lesson planning</span>
              <span className="px-3 py-1 rounded-full bg-purple-600/30 border border-purple-500/30">Homework support</span>
              <span className="px-3 py-1 rounded-full bg-purple-600/30 border border-purple-500/30">Parent communication</span>
            </div>
          </div>
        </div>

        <div className="section">
          <h2 className="text-lg font-semibold text-white mb-3">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.title}
                  onClick={() => router.push(action.href)}
                  className="card p-md text-left border transition-all hover:scale-[1.01]"
                  style={{
                    borderColor: `${action.accent}66`,
                    background: `linear-gradient(135deg, ${action.accent}22 0%, rgba(15,23,42,0.7) 70%)`,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-white">{action.title}</h3>
                      <p className="text-sm text-gray-300 mt-1">{action.description}</p>
                    </div>
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center border"
                      style={{ borderColor: `${action.accent}88`, background: `${action.accent}33` }}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="section">
          <div className="card p-md">
            <div className="flex items-center gap-2 mb-3">
              <Wand2 className="w-5 h-5 text-purple-300" />
              <h2 className="text-lg font-semibold text-white">Prompt Builder</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setPromptDraft(prompt)}
                  className="px-3 py-2 text-left text-xs rounded-lg border border-gray-700 bg-gray-900/80 hover:bg-gray-800 transition-colors text-gray-200"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <textarea
              value={promptDraft}
              onChange={(event) => setPromptDraft(event.target.value)}
              rows={5}
              placeholder="Write your custom teaching prompt..."
              className="w-full rounded-lg border border-gray-700 bg-gray-900 text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button
                onClick={handleOpenDashChat}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold text-white inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Open in Dash Chat
              </button>
              <button
                onClick={handleCopyPrompt}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-semibold text-gray-100 inline-flex items-center gap-2 border border-gray-700"
              >
                <MessageSquare className="w-4 h-4" />
                Copy Prompt
              </button>
              {copyMessage ? <span className="text-xs text-gray-300">{copyMessage}</span> : null}
            </div>
          </div>
        </div>
      </div>
    </TeacherShell>
  );
}
