/**
 * Preschool AI Lesson Generator
 * Creates age-appropriate lesson plans with teaching insights and take-home activities.
 * Specifically designed for preschool teachers at Young Eagles and similar preschools.
 * @module app/screens/preschool-lesson-generator
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { assertSupabase } from '@/lib/supabase';
import { LessonGeneratorService } from '@/lib/ai/lessonGenerator';
import { setPreferredModel } from '@/lib/ai/preferences';
import { useSimplePullToRefresh } from '@/hooks/usePullToRefresh';
import { useLessonGeneratorModels, useTierInfo } from '@/hooks/useAIModelSelection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/ToastProvider';
import { EducationalPDFService } from '@/lib/services/EducationalPDFService';
import { QuotaBar } from '@/components/ai-lesson-generator';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import { getCombinedUsage, incrementUsage, logUsageEvent } from '@/lib/ai/usage';
import { canUseFeature, getQuotaStatus } from '@/lib/ai/limits';
import { track } from '@/lib/analytics';

// Preschool-specific constants
const AGE_GROUPS = [
  { id: 'toddlers', label: 'Toddlers (1-2 years)', ageRange: '1-2', description: 'Early exploration and sensory play' },
  { id: 'preschool', label: 'Preschool (3-4 years)', ageRange: '3-4', description: 'Building foundational skills' },
  { id: 'prek', label: 'Pre-K (4-5 years)', ageRange: '4-5', description: 'Preparing for kindergarten' },
  { id: 'kindergarten', label: 'Kindergarten (5-6 years)', ageRange: '5-6', description: 'School readiness' },
];

const PRESCHOOL_SUBJECTS = [
  { id: 'colors', label: '🎨 Colors & Art', icon: 'color-palette', description: 'Color recognition, mixing, art activities' },
  { id: 'shapes', label: '🔷 Shapes & Patterns', icon: 'shapes', description: 'Shape identification, patterns, spatial awareness' },
  { id: 'numbers', label: '🔢 Numbers & Counting', icon: 'calculator', description: 'Counting, number recognition, basic math concepts' },
  { id: 'letters', label: '🔤 Letters & Sounds', icon: 'text', description: 'Letter recognition, phonics, early literacy' },
  { id: 'nature', label: '🌿 Nature & Science', icon: 'leaf', description: 'Plants, animals, weather, simple experiments' },
  { id: 'social', label: '🤝 Social Skills', icon: 'people', description: 'Sharing, emotions, friendship, manners' },
  { id: 'motor', label: '🏃 Motor Skills', icon: 'body', description: 'Fine and gross motor development' },
  { id: 'music', label: '🎵 Music & Movement', icon: 'musical-notes', description: 'Songs, rhythm, dance, instruments' },
  { id: 'storytime', label: '📚 Storytime & Language', icon: 'book', description: 'Story comprehension, vocabulary, speaking' },
  { id: 'sensory', label: '👐 Sensory Play', icon: 'hand-left', description: 'Texture exploration, sensory bins, tactile learning' },
];

const DURATION_OPTIONS = [
  { value: '15', label: '15 min', description: 'Quick activity' },
  { value: '20', label: '20 min', description: 'Short lesson' },
  { value: '30', label: '30 min', description: 'Standard lesson' },
  { value: '45', label: '45 min', description: 'Extended lesson' },
];

type LanguageCode = 'en' | 'af' | 'zu' | 'st';

interface GeneratedContent {
  lesson: string;
  insights: string;
  homework: string;
}

export default function PreschoolLessonGeneratorScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const palette = useMemo(() => ({
    bg: theme.background,
    text: theme.text,
    textSec: theme.textSecondary,
    outline: theme.border,
    surface: theme.surface,
    primary: theme.primary,
    accent: theme.accent,
  }), [theme]);

  // Form state
  const [topic, setTopic] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string | null>(null);
  const [duration, setDuration] = useState('30');
  const [includeHomework, setIncludeHomework] = useState(true);
  const [includeInsights, setIncludeInsights] = useState(true);
  const [language, setLanguage] = useState<LanguageCode>('en');
  
  // Generation state
  const [generated, setGenerated] = useState<GeneratedContent | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'lesson' | 'insights' | 'homework'>('lesson');
  
  // Usage state
  const [usage, setUsage] = useState({ lesson_generation: 0 });
  const [quotaStatus, setQuotaStatus] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  
  const { availableModels, selectedModel, setSelectedModel, isLoading: modelsLoading } = useLessonGeneratorModels();
  const { tierInfo } = useTierInfo();
  
  const isQuotaExhausted = Boolean(quotaStatus && quotaStatus.limit !== -1 && quotaStatus.used >= quotaStatus.limit);
  const AI_ENABLED = process.env.EXPO_PUBLIC_AI_ENABLED === 'true' || process.env.EXPO_PUBLIC_ENABLE_AI_FEATURES === 'true';
  const flags = getFeatureFlagsSync();

  const categoriesQuery = useQuery({
    queryKey: ['lesson_categories'],
    queryFn: async () => {
      const { data, error } = await assertSupabase().from('lesson_categories').select('id,name');
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
    staleTime: 60_000,
  });

  // Load initial usage
  useEffect(() => {
    (async () => {
      const u = await getCombinedUsage();
      setUsage({ lesson_generation: u.lesson_generation });
      try {
        const s = await getQuotaStatus('lesson_generation');
        setQuotaStatus(s);
      } catch (err) {
        console.warn('[PreschoolLessonGenerator] Failed to load quota:', err);
      }
    })();
  }, []);

  const refreshUsage = useCallback(async () => {
    const u = await getCombinedUsage();
    setUsage({ lesson_generation: u.lesson_generation });
    try {
      const s = await getQuotaStatus('lesson_generation');
      setQuotaStatus(s);
    } catch { /* non-fatal */ }
  }, []);

  const { refreshing, onRefreshHandler } = useSimplePullToRefresh(refreshUsage, 'preschool_lesson_generator');

  const selectedSubjectInfo = PRESCHOOL_SUBJECTS.find(s => s.id === selectedSubject);
  const selectedAgeGroupInfo = AGE_GROUPS.find(a => a.id === selectedAgeGroup);

  const buildPrompt = useCallback(() => {
    const subjectLabel = selectedSubjectInfo?.label.replace(/^[^\s]+\s/, '') || 'General';
    const ageLabel = selectedAgeGroupInfo?.label || 'Preschool (3-4 years)';
    const ageRange = selectedAgeGroupInfo?.ageRange || '3-4';
    const topicStr = topic.trim() || 'age-appropriate activity';
    
    let prompt = `You are an expert early childhood educator creating a preschool lesson plan.

**LESSON REQUIREMENTS:**
- Topic: ${topicStr}
- Subject Area: ${subjectLabel}
- Age Group: ${ageLabel} (ages ${ageRange})
- Duration: ${duration} minutes
- Language: ${language === 'af' ? 'Afrikaans' : language === 'zu' ? 'Zulu' : language === 'st' ? 'Sesotho' : 'English'}

**IMPORTANT GUIDELINES FOR PRESCHOOL:**
- Use simple, age-appropriate language
- Include hands-on, sensory activities
- Keep instructions short and clear
- Add movement breaks and transitions
- Include songs or rhymes when appropriate
- Consider attention spans (${selectedAgeGroup === 'toddlers' ? '2-5 minutes per activity' : selectedAgeGroup === 'preschool' ? '5-10 minutes per activity' : '10-15 minutes per activity'})
- Use visual aids and concrete materials
- Include social interaction opportunities

**FORMAT YOUR RESPONSE AS:**

## 📚 LESSON PLAN: [Title]

### Learning Objectives
- [3-4 age-appropriate objectives]

### Materials Needed
- [List all materials, keep simple and accessible]

### Circle Time (Opening)
[5-minute engaging introduction with song or story]

### Main Activity
[Step-by-step instructions with time estimates]

### Movement Break
[2-3 minute physical activity related to theme]

### Closure
[Wrap-up activity and preview of take-home activity]

---`;

    if (includeInsights) {
      prompt += `

## 🔍 TEACHER INSIGHTS

Now provide helpful teaching insights:

### Developmental Focus
- What skills are being developed
- Milestones this activity targets

### Differentiation Tips
- How to simplify for struggling learners
- How to extend for advanced learners

### Common Challenges
- Typical issues and solutions
- Behavior management tips

### Assessment Ideas
- Informal ways to check understanding
- Observation checklist items

---`;
    }

    if (includeHomework) {
      prompt += `

## 🏠 TAKE-HOME ACTIVITY (Homework)

Create a simple take-home activity for parents:

### Activity Name
[Fun, engaging name]

### Parent Instructions
[Clear, simple instructions parents can follow]
[Maximum 3-4 steps]

### Materials at Home
[Only common household items]

### Learning Connection
[Brief explanation of what child is learning]

### Conversation Starters
[3 questions parents can ask their child about the activity]

### Photo Opportunity
[Suggest a photo moment to share with teacher]`;
    }

    return prompt;
  }, [topic, selectedSubject, selectedAgeGroup, duration, language, includeInsights, includeHomework, selectedSubjectInfo, selectedAgeGroupInfo]);

  const handleGenerate = useCallback(async () => {
    if (isQuotaExhausted) {
      router.push('/pricing');
      return;
    }
    
    if (!selectedSubject) {
      Alert.alert('Select Subject', 'Please select a subject area for your lesson.');
      return;
    }
    
    if (!selectedAgeGroup) {
      Alert.alert('Select Age Group', 'Please select an age group for your lesson.');
      return;
    }

    try {
      setPending(true);
      setProgress(0);
      setProgressMessage('Initializing...');
      setErrorMsg(null);
      setGenerated(null);

      if (!AI_ENABLED || flags.ai_lesson_generation === false) {
        toast.warn('AI Lesson Generator is disabled.');
        setPending(false);
        return;
      }

      // Simulated progress
      const progressTimer = setInterval(() => {
        setProgress(prev => {
          if (prev < 90) {
            const next = Math.min(prev + (Math.random() * 6 + 2), 90);
            if (next < 20) setProgressMessage('Preparing lesson structure...');
            else if (next < 40) setProgressMessage('Creating activities...');
            else if (next < 60) setProgressMessage('Generating teaching insights...');
            else if (next < 80) setProgressMessage('Designing take-home activity...');
            else setProgressMessage('Finalizing...');
            return next;
          }
          return prev;
        });
      }, 500);

      // Check quota
      let gate: { allowed: boolean } | null = null;
      try {
        gate = await canUseFeature('lesson_generation', 1);
      } catch {
        gate = { allowed: true };
      }

      if (!gate?.allowed) {
        clearInterval(progressTimer);
        const status = await getQuotaStatus('lesson_generation');
        Alert.alert('Monthly limit reached', `You have used ${status.used} of ${status.limit} generations.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'See plans', onPress: () => router.push('/pricing') },
        ]);
        setPending(false);
        return;
      }

      track('edudash.ai.preschool_lesson.generate_started', { subject: selectedSubject, ageGroup: selectedAgeGroup });

      const prompt = buildPrompt();
      const payload = {
        action: 'lesson_generation',
        prompt,
        topic: topic || 'Preschool Activity',
        subject: selectedSubjectInfo?.label || 'General',
        gradeLevel: 0, // Preschool
        duration: Number(duration) || 30,
        objectives: [],
        language: language || 'en',
        model: selectedModel || process.env.EXPO_PUBLIC_ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
        isPreschool: true,
        ageGroup: selectedAgeGroup,
        includeHomework,
        includeInsights,
      };

      const { data, error } = await assertSupabase().functions.invoke('ai-gateway', { body: payload });

      clearInterval(progressTimer);
      setProgress(95);
      setProgressMessage('Processing results...');

      if (error) throw error;

      const content = data?.content || '';
      setProgress(100);
      setProgressMessage('Complete!');

      // Parse sections from generated content
      const lessonMatch = content.match(/## 📚 LESSON PLAN[\s\S]*?(?=## 🔍 TEACHER INSIGHTS|## 🏠 TAKE-HOME|$)/);
      const insightsMatch = content.match(/## 🔍 TEACHER INSIGHTS[\s\S]*?(?=## 🏠 TAKE-HOME|$)/);
      const homeworkMatch = content.match(/## 🏠 TAKE-HOME ACTIVITY[\s\S]*$/);

      setGenerated({
        lesson: lessonMatch ? lessonMatch[0].trim() : content,
        insights: insightsMatch ? insightsMatch[0].trim() : '',
        homework: homeworkMatch ? homeworkMatch[0].trim() : '',
      });

      // Track usage
      try {
        await incrementUsage('lesson_generation', 1);
        await logUsageEvent({
          feature: 'lesson_generation',
          model: String(payload.model),
          tokensIn: data?.usage?.input_tokens || 0,
          tokensOut: data?.usage?.output_tokens || 0,
          estCostCents: data?.cost || 0,
          timestamp: new Date().toISOString(),
        });
      } catch (usageError) {
        console.error('[PreschoolLessonGenerator] Failed to track usage:', usageError);
      }

      await refreshUsage();
      toast.success('Lesson generated!');
      track('edudash.ai.preschool_lesson.generate_completed', { subject: selectedSubject, ageGroup: selectedAgeGroup });

    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Please try again';
      track('edudash.ai.preschool_lesson.generate_failed', { error: message });
      setErrorMsg(message);
      toast.error(`Generation failed: ${message}`);
    } finally {
      setPending(false);
      setProgress(0);
      setProgressMessage('');
    }
  }, [isQuotaExhausted, selectedSubject, selectedAgeGroup, AI_ENABLED, flags, buildPrompt, topic, selectedSubjectInfo, duration, language, selectedModel, includeHomework, includeInsights, refreshUsage]);

  const onSave = useCallback(async () => {
    if (!generated?.lesson) {
      toast.warn('Generate a lesson first');
      return;
    }
    
    try {
      setSaving(true);
      const { data: auth } = await assertSupabase().auth.getUser();
      const { data: teacherProfile } = await assertSupabase()
        .from('profiles')
        .select('id,preschool_id,organization_id')
        .eq('id', auth?.user?.id || '')
        .maybeSingle();
        
      if (!teacherProfile) {
        toast.error('Not signed in');
        return;
      }
      
      const schoolId = teacherProfile.preschool_id || teacherProfile.organization_id;
      const categoryId = categoriesQuery.data?.[0]?.id;
      
      if (!categoryId) {
        toast.warn('Create a category first');
        return;
      }

      // Combine all content for saving
      const fullDescription = [
        generated.lesson,
        generated.insights ? `\n---\n${generated.insights}` : '',
        generated.homework ? `\n---\n${generated.homework}` : '',
      ].filter(Boolean).join('\n');

      const res = await LessonGeneratorService.saveGeneratedLesson({
        lesson: {
          title: `${selectedSubjectInfo?.label || 'Activity'}: ${topic || 'Preschool Lesson'}`,
          description: fullDescription,
          content: generated.lesson,
        },
        teacherId: teacherProfile.id,
        preschoolId: schoolId,
        ageGroupId: selectedAgeGroup || 'preschool',
        categoryId,
        template: { duration: Number(duration) || 30, complexity: 'moderate' },
        isPublished: true,
      });

      if (!res.success) {
        toast.error(`Save failed: ${res.error || 'Unknown error'}`);
        return;
      }

      toast.success(`Lesson saved!`);
      track('edudash.ai.preschool_lesson.saved', { lessonId: res.lessonId });
    } catch (e: unknown) {
      toast.error(`Save error: ${e instanceof Error ? e.message : 'Failed'}`);
    } finally {
      setSaving(false);
    }
  }, [generated, categoriesQuery.data, selectedSubjectInfo, topic, selectedAgeGroup, duration]);

  const onShareHomework = useCallback(async () => {
    if (!generated?.homework) {
      toast.warn('Generate a lesson with homework first');
      return;
    }

    try {
      const shareContent = `📚 Take-Home Activity from ${profile?.first_name || 'Teacher'}\n\n${generated.homework}\n\n---\nFrom EduDash Pro - Young Eagles`;
      
      await Share.share({
        message: shareContent,
        title: 'Take-Home Activity',
      });
      
      track('edudash.ai.preschool_lesson.homework_shared', {});
    } catch (error) {
      console.error('Share failed:', error);
    }
  }, [generated?.homework, profile?.first_name]);

  const onExportPDF = useCallback(async () => {
    if (!generated?.lesson) {
      Alert.alert('Export PDF', 'Generate a lesson first.');
      return;
    }

    try {
      const fullContent = [
        generated.lesson,
        generated.insights ? `\n\n${generated.insights}` : '',
        generated.homework ? `\n\n${generated.homework}` : '',
      ].join('');

      await EducationalPDFService.generateTextPDF(
        `${selectedSubjectInfo?.label || 'Lesson'}: ${topic || 'Preschool Activity'}`,
        fullContent
      );
      toast.success('PDF generated');
    } catch {
      toast.error('Failed to generate PDF');
    }
  }, [generated, selectedSubjectInfo, topic]);

  const renderSubjectButton = (subject: typeof PRESCHOOL_SUBJECTS[0]) => {
    const isSelected = selectedSubject === subject.id;
    return (
      <TouchableOpacity
        key={subject.id}
        style={[
          styles.subjectButton,
          {
            backgroundColor: isSelected ? theme.primary + '20' : palette.surface,
            borderColor: isSelected ? theme.primary : palette.outline,
          },
        ]}
        onPress={() => setSelectedSubject(subject.id)}
      >
        <Ionicons
          name={subject.icon as any}
          size={20}
          color={isSelected ? theme.primary : palette.textSec}
        />
        <Text style={[styles.subjectLabel, { color: isSelected ? theme.primary : palette.text }]}>
          {subject.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderAgeGroupButton = (ageGroup: typeof AGE_GROUPS[0]) => {
    const isSelected = selectedAgeGroup === ageGroup.id;
    return (
      <TouchableOpacity
        key={ageGroup.id}
        style={[
          styles.ageGroupButton,
          {
            backgroundColor: isSelected ? theme.accent + '20' : palette.surface,
            borderColor: isSelected ? theme.accent : palette.outline,
          },
        ]}
        onPress={() => setSelectedAgeGroup(ageGroup.id)}
      >
        <Text style={[styles.ageGroupLabel, { color: isSelected ? theme.accent : palette.text }]}>
          {ageGroup.label}
        </Text>
        <Text style={[styles.ageGroupDesc, { color: palette.textSec }]}>
          {ageGroup.description}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
      <ScreenHeader
        title="Preschool Lesson Creator"
        subtitle="Create age-appropriate lessons with insights & homework"
        showBackButton
      />

      {/* Hero Badge */}
      <LinearGradient
        colors={['#FF6B6B', '#FF8E53']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.heroBadge}
      >
        <Ionicons name="sparkles" size={16} color="#FFF" />
        <Text style={styles.heroText}>Preschool Edition</Text>
        <View style={styles.heroStats}>
          <Text style={styles.heroStat}>{usage.lesson_generation} this month</Text>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefreshHandler}
            tintColor="#FF6B6B"
          />
        }
      >
        {/* Subject Selection */}
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.outline }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>📚 Choose Subject</Text>
          <View style={styles.subjectsGrid}>
            {PRESCHOOL_SUBJECTS.map(renderSubjectButton)}
          </View>
        </View>

        {/* Age Group Selection */}
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.outline }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>👶 Select Age Group</Text>
          <View style={styles.ageGroupsContainer}>
            {AGE_GROUPS.map(renderAgeGroupButton)}
          </View>
        </View>

        {/* Topic & Duration */}
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.outline }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>✏️ Lesson Details</Text>
          
          <Text style={[styles.label, { color: palette.textSec }]}>Topic (optional)</Text>
          <TextInput
            style={[styles.input, { color: palette.text, borderColor: palette.outline }]}
            value={topic}
            onChangeText={setTopic}
            placeholder={`e.g., ${selectedSubjectInfo?.description || 'Learning about colors'}`}
            placeholderTextColor={palette.textSec}
          />

          <Text style={[styles.label, { color: palette.textSec, marginTop: 12 }]}>Duration</Text>
          <View style={styles.durationRow}>
            {DURATION_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.durationButton,
                  {
                    backgroundColor: duration === opt.value ? theme.primary + '20' : 'transparent',
                    borderColor: duration === opt.value ? theme.primary : palette.outline,
                  },
                ]}
                onPress={() => setDuration(opt.value)}
              >
                <Text style={[styles.durationLabel, { color: duration === opt.value ? theme.primary : palette.text }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Options */}
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.outline }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>⚙️ Include</Text>
          
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setIncludeInsights(!includeInsights)}
          >
            <Ionicons
              name={includeInsights ? 'checkbox' : 'square-outline'}
              size={24}
              color={includeInsights ? theme.primary : palette.textSec}
            />
            <View style={styles.toggleInfo}>
              <Text style={[styles.toggleLabel, { color: palette.text }]}>🔍 Teaching Insights</Text>
              <Text style={[styles.toggleDesc, { color: palette.textSec }]}>
                Differentiation tips, assessment ideas, common challenges
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setIncludeHomework(!includeHomework)}
          >
            <Ionicons
              name={includeHomework ? 'checkbox' : 'square-outline'}
              size={24}
              color={includeHomework ? theme.primary : palette.textSec}
            />
            <View style={styles.toggleInfo}>
              <Text style={[styles.toggleLabel, { color: palette.text }]}>🏠 Take-Home Activity</Text>
              <Text style={[styles.toggleDesc, { color: palette.textSec }]}>
                Simple homework parents can do with their child
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Quota Bar */}
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.outline }]}>
          <Text style={{ color: palette.textSec }}>Monthly usage: {usage.lesson_generation} lessons</Text>
          <QuotaBar used={usage.lesson_generation} limit={quotaStatus?.limit || 5} />
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          onPress={handleGenerate}
          style={[
            styles.generateButton,
            { backgroundColor: isQuotaExhausted ? '#9CA3AF' : '#FF6B6B' },
          ]}
          disabled={pending}
        >
          {pending ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="sparkles" size={20} color="#FFF" />
              <Text style={styles.generateButtonText}>
                {isQuotaExhausted ? 'Upgrade Plan' : 'Generate Lesson'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Progress */}
        {pending && (
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: '#FF6B6B', marginTop: 16 }]}>
            <View style={styles.progressHeader}>
              <ActivityIndicator color="#FF6B6B" />
              <Text style={[styles.progressTitle, { color: '#FF6B6B' }]}>Generating...</Text>
            </View>
            <Text style={{ color: palette.textSec, fontSize: 13 }}>{progressMessage}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={[styles.progressPercent, { color: palette.textSec }]}>{Math.round(progress)}%</Text>
          </View>
        )}

        {/* Error */}
        {errorMsg && !pending && (
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: '#EF4444', borderWidth: 1, marginTop: 16 }]}>
            <View style={styles.errorHeader}>
              <Ionicons name="warning-outline" size={18} color="#EF4444" />
              <Text style={styles.errorTitle}>Generation Failed</Text>
            </View>
            <Text style={{ color: palette.textSec, fontSize: 13 }}>{errorMsg}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleGenerate}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Generated Content */}
        {generated && (
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: '#10B981', borderWidth: 2, marginTop: 16 }]}>
            <View style={styles.successHeader}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.successTitle}>Lesson Generated!</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'lesson' && styles.tabActive]}
                onPress={() => setActiveTab('lesson')}
              >
                <Text style={[styles.tabText, activeTab === 'lesson' && styles.tabTextActive]}>📚 Lesson</Text>
              </TouchableOpacity>
              {generated.insights && (
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'insights' && styles.tabActive]}
                  onPress={() => setActiveTab('insights')}
                >
                  <Text style={[styles.tabText, activeTab === 'insights' && styles.tabTextActive]}>🔍 Insights</Text>
                </TouchableOpacity>
              )}
              {generated.homework && (
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'homework' && styles.tabActive]}
                  onPress={() => setActiveTab('homework')}
                >
                  <Text style={[styles.tabText, activeTab === 'homework' && styles.tabTextActive]}>🏠 Homework</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Content */}
            <ScrollView style={styles.contentScroll}>
              <Text style={[styles.generatedText, { color: palette.text }]}>
                {activeTab === 'lesson' && generated.lesson}
                {activeTab === 'insights' && generated.insights}
                {activeTab === 'homework' && generated.homework}
              </Text>
            </ScrollView>

            {/* Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.primary }]}
                onPress={onSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={16} color="#FFF" />
                    <Text style={styles.actionButtonText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>

              {generated.homework && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#10B981' }]}
                  onPress={onShareHomework}
                >
                  <Ionicons name="share-social-outline" size={16} color="#FFF" />
                  <Text style={styles.actionButtonText}>Share Homework</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: palette.textSec }]}
                onPress={onExportPDF}
              >
                <Ionicons name="document-outline" size={16} color="#FFF" />
                <Text style={styles.actionButtonText}>PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  heroText: { color: '#FFF', fontWeight: '700', fontSize: 14, marginLeft: 6 },
  heroStats: { marginLeft: 'auto' },
  heroStat: { color: '#FFF', fontSize: 12, opacity: 0.9 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  subjectsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subjectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  subjectLabel: { fontSize: 12, fontWeight: '600' },
  ageGroupsContainer: { gap: 8 },
  ageGroupButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  ageGroupLabel: { fontSize: 14, fontWeight: '600' },
  ageGroupDesc: { fontSize: 11, marginTop: 2 },
  durationRow: { flexDirection: 'row', gap: 8 },
  durationButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  durationLabel: { fontSize: 13, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  toggleDesc: { fontSize: 12, marginTop: 2 },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  generateButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  progressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  progressTitle: { fontWeight: '600', marginLeft: 8 },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: '#E5E7EB', marginTop: 8 },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#FF6B6B' },
  progressPercent: { fontSize: 11, textAlign: 'center', marginTop: 4 },
  errorHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  errorTitle: { color: '#EF4444', fontWeight: '600', marginLeft: 8 },
  retryButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
    alignSelf: 'flex-start',
  },
  retryButtonText: { color: '#EF4444', fontWeight: '600' },
  successHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  successTitle: { color: '#10B981', fontWeight: '700', fontSize: 16, marginLeft: 8 },
  tabsContainer: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F3F4F6' },
  tabActive: { backgroundColor: '#FF6B6B' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#FFF' },
  contentScroll: { maxHeight: 300, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12 },
  generatedText: { fontSize: 14, lineHeight: 22 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: { color: '#FFF', fontWeight: '600', fontSize: 13 },
});
