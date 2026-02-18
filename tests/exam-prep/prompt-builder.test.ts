import { buildExamPrompt } from '@/components/exam-prep/prompt-builder';

describe('buildExamPrompt quality contract', () => {
  it('enforces CAPS quality + marking requirements for practice tests', () => {
    const { prompt } = buildExamPrompt({
      grade: 'grade_8',
      subject: 'Mathematics',
      examType: 'practice_test',
      language: 'en-ZA',
      customPrompt: '',
      enableInteractive: true,
    });

    expect(prompt).toContain('NON-NEGOTIABLE QUALITY BAR (CAPS)');
    expect(prompt).toContain('MANDATORY OUTPUT BLOCKS (include all)');
    expect(prompt).toContain('Full memorandum');
    expect(prompt).toContain('Worked examples');
    expect(prompt).toContain('Extra practice');
  });

  it('adds self-check and extra practice requirements for revision notes', () => {
    const { prompt } = buildExamPrompt({
      grade: 'grade_6',
      subject: 'Natural Sciences',
      examType: 'revision_notes',
      language: 'en-ZA',
      customPrompt: '',
      enableInteractive: false,
    });

    expect(prompt).toContain('Quick Self-Check (with Answers)');
    expect(prompt).toContain('Extra Practice');
    expect(prompt).toContain('answer key');
  });
});

