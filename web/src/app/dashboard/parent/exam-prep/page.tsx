'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { useParentDashboardData } from '@/lib/hooks/useParentDashboardData';
import { BookOpen, Target, FileText, Sparkles } from 'lucide-react';

const GRADES = [
  { value: 'grade_4', label: 'Grade 4' },
  { value: 'grade_5', label: 'Grade 5' },
  { value: 'grade_6', label: 'Grade 6' },
  { value: 'grade_7', label: 'Grade 7' },
  { value: 'grade_8', label: 'Grade 8' },
  { value: 'grade_9', label: 'Grade 9' },
  { value: 'grade_10', label: 'Grade 10' },
  { value: 'grade_11', label: 'Grade 11' },
  { value: 'grade_12', label: 'Grade 12' },
];

const SUBJECTS = [
  'Mathematics',
  'Physical Sciences',
  'Life Sciences',
  'English',
  'Afrikaans',
  'History',
  'Geography',
  'Accounting',
  'Business Studies',
  'Economics',
  'Computer Applications Technology',
];

export default function ExamPrepPage() {
  const router = useRouter();
  const { profile, userName, preschoolName, hasOrganization, unreadCount, loading } = useParentDashboardData();
  
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [examType, setExamType] = useState<'practice_test' | 'revision_notes'>('practice_test');

  const handleGenerate = () => {
    if (!selectedGrade || !selectedSubject) {
      alert('Please select both grade and subject');
      return;
    }

    const params = new URLSearchParams({
      grade: selectedGrade,
      subject: selectedSubject,
      type: examType
    });
    
    router.push(`/dashboard/parent/generate-exam?${params.toString()}`);
  };

  const handleViewHistory = () => {
    router.push('/dashboard/parent/my-exams');
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <ParentShell
      userEmail={profile?.email}
      userName={userName}
      preschoolName={preschoolName}
      unreadCount={unreadCount}
      hasOrganization={hasOrganization}
    >
      <div style={{ padding: 'var(--space-4)', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
            📚 Exam Prep
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Generate CAPS-aligned practice exams, revision notes, and study materials
          </p>
        </div>

        {/* Main Card */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>
              Grade Level
            </label>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--surface-1)',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            >
              <option value="">Select Grade</option>
              {GRADES.map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>
              Subject
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--surface-1)',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            >
              <option value="">Select Subject</option>
              {SUBJECTS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>
              Type
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setExamType('practice_test')}
                className={examType === 'practice_test' ? 'btn btnPrimary' : 'btn btnSecondary'}
                style={{ flex: 1 }}
              >
                <Target className="icon16" />
                Practice Test
              </button>
              <button
                onClick={() => setExamType('revision_notes')}
                className={examType === 'revision_notes' ? 'btn btnPrimary' : 'btn btnSecondary'}
                style={{ flex: 1 }}
              >
                <BookOpen className="icon16" />
                Revision Notes
              </button>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            className="btn btnPrimary"
            style={{ width: '100%', padding: '14px', fontSize: '16px' }}
            disabled={!selectedGrade || !selectedSubject}
          >
            <Sparkles className="icon20" />
            Generate with AI
          </button>
        </div>

        {/* Quick Actions */}
        <div style={{ marginTop: 'var(--space-4)', display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
          <button
            onClick={handleViewHistory}
            className="btn btnSecondary"
            style={{ padding: '14px' }}
          >
            <FileText className="icon16" />
            View My Exams
          </button>
        </div>
      </div>
    </ParentShell>
  );
}
