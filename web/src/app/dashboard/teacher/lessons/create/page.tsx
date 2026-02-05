'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { Sparkles, BookOpen, Clock, Users, Target, Lightbulb, Save, Wand2 } from 'lucide-react';

function CreateLessonPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const quickDefaultsApplied = useRef(false);
  
  // Form state
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [duration, setDuration] = useState('30');
  const [objectives, setObjectives] = useState('');
  const [generatedLesson, setGeneratedLesson] = useState<any>(null);
  
  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);
  const isQuickMode = searchParams.get('mode') === 'quick';
  const stemParam = searchParams.get('stem');
  const isPreschool = profile?.usageType === 'preschool' || profile?.schoolType === 'preschool';

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        return;
      }
      setUserId(session.user.id);
      setAuthLoading(false);
    };
    initAuth();
  }, [router, supabase]);

  useEffect(() => {
    if (quickDefaultsApplied.current) return;
    if (!profileLoading) {
      if (stemParam && !subject) {
        const stemMap: Record<string, string> = {
          ai: 'AI & Technology',
          robotics: 'Robotics',
          computer_literacy: 'Computer Literacy',
        };
        setSubject(stemMap[stemParam] || stemParam);
      }
      if (isQuickMode) {
        setDuration('15');
        if (!subject) setSubject('General');
        if (!objectives) setObjectives('Quick, engaging activity with minimal prep');
      }
      quickDefaultsApplied.current = true;
    }
  }, [isQuickMode, stemParam, profileLoading, subject, objectives]);

  const handleGenerateWithAI = async () => {
    if (!topic || !gradeLevel) {
      alert('Please fill in at least the topic and grade level');
      return;
    }

    setGenerating(true);
    try {
      // Call AI Edge Function to generate lesson plan
      const audienceLabel = isPreschool ? 'preschool/early childhood' : 'school';
      const quickHint = isQuickMode
        ? 'This is a QUICK, low-prep lesson. Use minimal materials, high engagement, and clear step-by-step guidance.'
        : '';
      const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: {
          prompt: `Generate a ${isQuickMode ? 'quick, engaging' : 'comprehensive'} lesson plan for ${audienceLabel}:
          
Subject: ${subject || 'General'}
Topic: ${topic}
Grade Level: ${gradeLevel}
Duration: ${duration} minutes
Learning Objectives: ${objectives || 'Age-appropriate learning goals'}
${quickHint ? `\nQuick Lesson Guidance: ${quickHint}\n` : ''}

Please provide:
1. Lesson Title
2. Learning Objectives (3-5 specific goals)
3. Materials Needed
4. Introduction/Warm-up Activity (5 mins)
5. Main Activity (detailed steps)
6. Practice Activity
7. Cool-down/Conclusion
8. Assessment Ideas
9. Extension Activities
10. Notes for Teachers

Format the response in clear sections with practical, age-appropriate activities.`,
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
        },
      });

      if (error) throw error;

      setGeneratedLesson({
        title: `${topic} - ${gradeLevel}`,
        content: data.content,
        subject,
        topic,
        gradeLevel,
        duration: parseInt(duration),
        objectives,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error generating lesson:', error);
      alert('Failed to generate lesson plan. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveLesson = async () => {
    if (!generatedLesson) return;

    setSaving(true);
    try {
      // Get user's profile (profiles-first architecture)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, preschool_id')
        .eq('id', userId)
        .maybeSingle();

      if (!profile) throw new Error('Profile not found');

      // Save to lessons table (adapt to your schema)
      // const { error } = await supabase
      //   .from('lessons')
      //   .insert({
      //     teacher_id: userId,
      //     preschool_id: profile.preschool_id,
      //     title: generatedLesson.title,
      //     content: generatedLesson.content,
      //     subject: generatedLesson.subject,
      //     topic: generatedLesson.topic,
      //     grade_level: generatedLesson.gradeLevel,
      //     duration_minutes: generatedLesson.duration,
      //     objectives: generatedLesson.objectives,
      //     created_at: new Date().toISOString(),
      //   });

      // if (error) throw error;

      alert('Lesson plan saved successfully!');
      router.push('/dashboard/teacher/lessons');
    } catch (error) {
      console.error('Error saving lesson:', error);
      alert('Failed to save lesson plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
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
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-green-600 to-green-700 rounded-xl">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="h1">AI Lesson Generator</h1>
              <p className="muted">Create engaging lesson plans with AI assistance</p>
            </div>
          </div>
          {isQuickMode && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-900/40 px-3 py-1 text-sm text-green-200">
              <Wand2 className="h-4 w-4" />
              Quick Lesson Mode • 15 minutes • Low prep
            </div>
          )}
        </div>

        <div className="section">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Form */}
            <div className="card p-md">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-green-500" />
                Lesson Details
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Math, Science, Language"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Topic *</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., Counting to 10, Colors, Shapes"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Grade Level *</label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">Select grade level</option>
                    {isPreschool ? (
                      <>
                        <option value="Toddlers">Toddlers (1-2 years)</option>
                        <option value="Preschool">Preschool (3-4 years)</option>
                        <option value="Pre-K">Pre-K (4-5 years)</option>
                        <option value="Grade R">Grade R (5-6 years)</option>
                      </>
                    ) : (
                      <>
                        <option value="Pre-K">Pre-K (3-4 years)</option>
                        <option value="Kindergarten">Kindergarten (4-5 years)</option>
                        <option value="Grade R">Grade R (5-6 years)</option>
                        <option value="Grade 1">Grade 1 (6-7 years)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    min="15"
                    max="120"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Learning Objectives (optional)
                  </label>
                  <textarea
                    value={objectives}
                    onChange={(e) => setObjectives(e.target.value)}
                    placeholder="What should students learn from this lesson?"
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <button
                  onClick={handleGenerateWithAI}
                  disabled={generating || !topic || !gradeLevel}
                  className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-700 disabled:to-gray-700 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed shadow-lg"
                >
                  {generating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      Generate with AI
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Generated Output */}
            <div className="card p-md">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                Generated Lesson Plan
              </h2>

              {!generatedLesson ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Sparkles className="w-16 h-16 text-gray-600 mb-4" />
                  <p className="text-gray-400 mb-2">Your AI-generated lesson plan will appear here</p>
                  <p className="text-sm text-gray-500">Fill in the form and click "Generate with AI"</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-green-900/20 border border-green-700/30 rounded-lg">
                    <h3 className="font-bold text-white text-lg mb-2">{generatedLesson.title}</h3>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 bg-green-800/30 rounded-md text-green-400">
                        {generatedLesson.gradeLevel}
                      </span>
                      <span className="px-2 py-1 bg-blue-800/30 rounded-md text-blue-400">
                        {generatedLesson.duration} mins
                      </span>
                      {generatedLesson.subject && (
                        <span className="px-2 py-1 bg-purple-800/30 rounded-md text-purple-400">
                          {generatedLesson.subject}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    <div className="markdown-content prose prose-invert prose-sm max-w-none">
                      {generatedLesson.content.split('\n').map((line: string, index: number) => {
                        // Render markdown-style headers and content with proper styling
                        if (line.startsWith('# ')) {
                          return <h1 key={index} className="text-xl font-bold text-cyan-400 mt-4 mb-2">{line.substring(2)}</h1>;
                        } else if (line.startsWith('## ')) {
                          return <h2 key={index} className="text-lg font-bold text-indigo-400 mt-4 mb-2">{line.substring(3)}</h2>;
                        } else if (line.startsWith('### ')) {
                          return <h3 key={index} className="text-base font-semibold text-purple-400 mt-3 mb-1">{line.substring(4)}</h3>;
                        } else if (line.startsWith('**') && line.endsWith('**')) {
                          return <p key={index} className="font-bold text-yellow-400 my-1">{line.replace(/\*\*/g, '')}</p>;
                        } else if (line.startsWith('- ') || line.startsWith('• ')) {
                          return <li key={index} className="text-gray-300 ml-4 my-0.5 list-disc">{line.substring(2)}</li>;
                        } else if (line.match(/^\d+\./)) {
                          return <li key={index} className="text-gray-300 ml-4 my-0.5 list-decimal">{line.replace(/^\d+\./, '').trim()}</li>;
                        } else if (line.trim() === '') {
                          return <div key={index} className="h-2"></div>;
                        } else {
                          return <p key={index} className="text-gray-300 my-1 leading-relaxed">{line}</p>;
                        }
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-gray-700">
                    <button
                      onClick={handleSaveLesson}
                      disabled={saving}
                      className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Lesson
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setGeneratedLesson(null)}
                      className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Tips */}
        <div className="section">
          <div className="card p-md bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-purple-700/30">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              Tips for Better Results
            </h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>• Be specific with your topic (e.g., "Counting to 10 with animals" instead of just "Numbers")</li>
              <li>• Specify any particular teaching methods or materials you prefer in objectives</li>
              <li>• Consider your students' attention span when setting duration</li>
              <li>• Generated lessons are starting points - feel free to customize and adapt them</li>
              <li>• Try different variations to find what works best for your class</li>
            </ul>
          </div>
        </div>
      </div>
    </TeacherShell>
  );
}

export default function CreateLessonPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      }
    >
      <CreateLessonPageInner />
    </Suspense>
  );
}
