'use client';

import { useMemo, useState } from 'react';
import { Sparkles, GraduationCap, BookOpen, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TutorModePanelProps {
  onStart: (prompt: string) => void;
}

const GRADES = [
  'Grade R', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
];

const SUBJECTS = [
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

const LANGUAGES = ['English', 'Afrikaans', 'isiZulu'];

export function TutorModePanel({ onStart }: TutorModePanelProps) {
  const { t } = useTranslation('common');
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [goal, setGoal] = useState('');
  const [language, setLanguage] = useState('English');

  const prompt = useMemo(() => {
    const missing: string[] = [];
    if (!grade) missing.push('grade');
    if (!subject) missing.push('subject');
    if (!topic) missing.push('topic');

    const missingText = missing.length > 0
      ? `Missing info: ${missing.join(', ')}. Ask me for these before teaching.`
      : 'All key info provided.';

    return `Tutor mode.\nGrade: ${grade || 'unknown'}.\nSubject: ${subject || 'unknown'}.\nTopic: ${topic || 'unknown'}.\nGoal: ${goal || 'help me understand and practice'}.\nPreferred language: ${language}.\n${missingText}\nStart with ONE short diagnostic question. Teach step-by-step. Ask one question at a time and wait for my response.`;
  }, [grade, subject, topic, goal, language]);

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
                {GRADES.map((g) => (
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
                {SUBJECTS.map((s) => (
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
              placeholder={t('dashChat.goalPlaceholder')}
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
