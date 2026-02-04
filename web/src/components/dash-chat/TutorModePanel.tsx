'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, GraduationCap, BookOpen, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getGradeNumber } from '@/lib/utils/gradeUtils';

interface TutorModePanelProps {
  onStart: (prompt: string) => void;
  learnerContext?: {
    learnerName?: string | null;
    grade?: string | null;
    ageYears?: number | null;
    usageType?: string | null;
    schoolType?: string | null;
  } | null;
}

const K12_GRADES = [
  'Grade R', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
];

const K12_SUBJECTS = [
  'Mathematics',
  'English Home Language',
  'English First Additional Language',
  'Afrikaans Home Language',
  'Afrikaans First Additional Language',
  'isiZulu Home Language',
  'isiZulu First Additional Language',
  'Life Sciences',
  'Physical Sciences',
  'Natural Sciences',
  'Social Sciences',
  'Technology',
  'Geography',
  'History',
  'Accounting',
  'Business Studies',
  'Life Orientation',
];

const EARLY_SUBJECTS = [
  'Literacy',
  'Numeracy',
  'Life Skills',
  'Creative Arts',
  'Early Learning',
  'Phonics & Sounds',
];

const PRESCHOOL_GRADES = [
  'Preschool (3-4)',
  'Preschool (4-5)',
  'Preschool (5-6)',
  'Grade R',
];

const FOUNDATION_GRADES = [
  'Grade R',
  'Grade 1',
  'Grade 2',
  'Grade 3',
];

const LANGUAGES = ['English', 'Afrikaans', 'isiZulu'];

const formatGradeLabel = (value?: string | null): string => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (lower.startsWith('grade')) return raw.replace(/\s+/g, ' ');
  if (lower === 'r' || lower.includes('grade r')) return 'Grade R';
  const match = raw.match(/\d+/);
  if (match) return `Grade ${match[0]}`;
  if (lower.includes('preschool') || lower.includes('pre-k') || lower.includes('prek')) return 'Preschool';
  return raw;
};

export function TutorModePanel({ onStart, learnerContext }: TutorModePanelProps) {
  const { t } = useTranslation('common');
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [goal, setGoal] = useState('');
  const [language, setLanguage] = useState('English');

  const normalizedSchool = `${learnerContext?.schoolType || learnerContext?.usageType || ''}`.toLowerCase();
  const gradeNumber = getGradeNumber(learnerContext?.grade || '');
  const ageYears = learnerContext?.ageYears ?? null;
  const isPreschoolContext =
    normalizedSchool.includes('preschool') ||
    normalizedSchool.includes('ecd') ||
    normalizedSchool.includes('early') ||
    gradeNumber === 0 ||
    (typeof ageYears === 'number' && ageYears <= 5);
  const isFoundationPhase = gradeNumber > 0 && gradeNumber <= 3;
  const isEarlyLearner = isPreschoolContext || isFoundationPhase || (typeof ageYears === 'number' && ageYears <= 8);

  const gradeOptions = useMemo(() => {
    const base = isPreschoolContext
      ? PRESCHOOL_GRADES
      : isFoundationPhase
        ? FOUNDATION_GRADES
        : K12_GRADES;
    const childLabel = formatGradeLabel(learnerContext?.grade);
    if (childLabel && !base.includes(childLabel)) {
      return [childLabel, ...base];
    }
    return base;
  }, [isPreschoolContext, isFoundationPhase, learnerContext?.grade]);

  const subjectOptions = useMemo(() => (isEarlyLearner ? EARLY_SUBJECTS : K12_SUBJECTS), [isEarlyLearner]);

  useEffect(() => {
    const childLabel = formatGradeLabel(learnerContext?.grade);
    if (!childLabel) return;
    setGrade((prev) => (prev ? prev : childLabel));
  }, [learnerContext?.grade]);

  const prompt = useMemo(() => {
    const missing: string[] = [];
    if (!grade && !ageYears) missing.push('age or grade');
    if (!subject) missing.push('subject');
    if (!topic) missing.push('topic');

    const missingText = missing.length > 0
      ? `Missing info: ${missing.join(', ')}. Ask me for these before teaching.`
      : 'All key info provided.';

    const learnerName = learnerContext?.learnerName ? `Learner: ${learnerContext.learnerName}.` : '';
    const ageLine = typeof ageYears === 'number' ? `Age: ${ageYears}.` : '';
    const schoolLine = learnerContext?.schoolType || learnerContext?.usageType ? `School type: ${learnerContext?.schoolType || learnerContext?.usageType}.` : '';
    const earlyRule = isEarlyLearner
      ? 'Use play-based, gentle scaffolding. Avoid exam-prep language. Speak directly to the learner, ask one simple question at a time, and offer interactive activities or games.'
      : 'Start with ONE short diagnostic question. Teach step-by-step. Ask one question at a time and wait for my response.';

    return [
      'Tutor mode.',
      learnerName,
      ageLine,
      schoolLine,
      `Grade: ${grade || 'unknown'}.`,
      `Subject: ${subject || 'unknown'}.`,
      `Topic: ${topic || 'unknown'}.`,
      `Goal: ${goal || (isEarlyLearner ? 'help me learn with simple practice' : 'help me understand and practice')}.`,
      `Preferred language: ${language}.`,
      missingText,
      earlyRule,
    ].filter(Boolean).join('\n');
  }, [grade, subject, topic, goal, language, learnerContext?.learnerName, learnerContext?.schoolType, learnerContext?.usageType, ageYears, isEarlyLearner]);

  return (
    <div className="border-b border-gray-800 bg-gray-950/80" style={{
      padding: '12px 16px',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)'
    }}>
      <div className="w-full max-w-4xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={18} style={{ color: 'var(--primary)' }} />
          <div style={{ fontWeight: 600 }}>{t('dashChat.tutorModeTitle')}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {t('dashChat.tutorModeSubtitle')}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('dashChat.gradeLabel')}</span>
            <div style={{ position: 'relative' }}>
              <GraduationCap size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--muted)' }} />
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 30px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  color: 'var(--text)'
                }}
              >
                <option value="">{t('dashChat.selectGrade')}</option>
                {gradeOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('dashChat.subjectLabel')}</span>
            <div style={{ position: 'relative' }}>
              <BookOpen size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--muted)' }} />
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 30px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  color: 'var(--text)'
                }}
              >
                <option value="">{t('dashChat.selectSubject')}</option>
                {subjectOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('dashChat.topicLabel')}</span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t('dashChat.topicPlaceholder')}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text)'
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('dashChat.goalLabel')}</span>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={isEarlyLearner ? t('dashChat.goalPlaceholderPreschool', { defaultValue: 'e.g., counting, letter sounds, social skills' }) : t('dashChat.goalPlaceholder')}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text)'
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('dashChat.languageLabel')}</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text)'
              }}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => onStart(prompt)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <MessageSquare size={16} />
            {t('dashChat.startTutorSession')}
          </button>
          <button
            onClick={() => {
              setGrade('');
              setSubject('');
              setTopic('');
              setGoal('');
            }}
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text)',
              cursor: 'pointer'
            }}
          >
            {t('dashChat.clear')}
          </button>
        </div>
      </div>
    </div>
  );
}
