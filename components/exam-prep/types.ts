/**
 * Exam Prep Types
 * Shared TypeScript definitions for the exam preparation system
 */

// South African language codes
export type SouthAfricanLanguage = 'en-ZA' | 'af-ZA' | 'zu-ZA' | 'xh-ZA' | 'nso-ZA';

export const LANGUAGE_OPTIONS: Record<SouthAfricanLanguage, string> = {
  'en-ZA': 'English (South Africa)',
  'af-ZA': 'Afrikaans',
  'zu-ZA': 'isiZulu',
  'xh-ZA': 'isiXhosa',
  'nso-ZA': 'Sepedi (Northern Sotho)',
};

export interface GradeInfo {
  value: string;
  label: string;
  age: string;
}

export const GRADES: GradeInfo[] = [
  { value: 'grade_r', label: 'Grade R', age: '5-6' },
  { value: 'grade_1', label: 'Grade 1', age: '6-7' },
  { value: 'grade_2', label: 'Grade 2', age: '7-8' },
  { value: 'grade_3', label: 'Grade 3', age: '8-9' },
  { value: 'grade_4', label: 'Grade 4', age: '9-10' },
  { value: 'grade_5', label: 'Grade 5', age: '10-11' },
  { value: 'grade_6', label: 'Grade 6', age: '11-12' },
  { value: 'grade_7', label: 'Grade 7', age: '12-13' },
  { value: 'grade_8', label: 'Grade 8', age: '13-14' },
  { value: 'grade_9', label: 'Grade 9', age: '14-15' },
  { value: 'grade_10', label: 'Grade 10', age: '15-16' },
  { value: 'grade_11', label: 'Grade 11', age: '16-17' },
  { value: 'grade_12', label: 'Grade 12 (Matric)', age: '17-18' },
];

export interface ExamType {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  duration: string;
}

export const EXAM_TYPES: ExamType[] = [
  { id: 'practice_test', label: 'Practice Test', description: 'Full exam paper with memo', icon: 'document-text', color: '#007bff', duration: '60-120 min' },
  { id: 'revision_notes', label: 'Revision Notes', description: 'Topic summaries & key points', icon: 'book', color: '#ff6b35', duration: '30 min read' },
  { id: 'study_guide', label: 'Study Guide', description: 'Week-long study schedule', icon: 'calendar', color: '#ffc107', duration: '7-day plan' },
  { id: 'flashcards', label: 'Flashcards', description: 'Quick recall questions', icon: 'bulb', color: '#dc3545', duration: '15 min' },
];

// CAPS-aligned subjects by phase
export const SUBJECTS_BY_PHASE = {
  // Foundation Phase (Grades R-3)
  foundation: [
    'English Home Language',
    'English First Additional Language',
    'Afrikaans Home Language',
    'Afrikaans First Additional Language',
    'isiZulu Home Language',
    'isiZulu First Additional Language',
    'isiXhosa Home Language',
    'isiXhosa First Additional Language',
    'Sepedi Home Language',
    'Sepedi First Additional Language',
    'Mathematics',
    'Life Skills',
  ],
  
  // Intermediate Phase (Grades 4-6)
  intermediate: [
    'English Home Language',
    'English First Additional Language',
    'Afrikaans Home Language',
    'Afrikaans First Additional Language',
    'isiZulu Home Language',
    'isiZulu First Additional Language',
    'Mathematics',
    'Natural Sciences & Technology',
    'History',
    'Geography',
    'Life Skills',
  ],
  
  // Senior Phase (Grades 7-9)
  senior: [
    'English Home Language',
    'English First Additional Language',
    'Afrikaans Home Language',
    'Afrikaans First Additional Language',
    'isiZulu Home Language',
    'isiZulu First Additional Language',
    'Mathematics',
    'Natural Sciences',
    'History',
    'Geography',
    'Technology',
    'Economic & Management Sciences',
    'Life Orientation',
    'Creative Arts',
  ],
  
  // FET Phase (Grades 10-12)
  fet: [
    'English Home Language',
    'English First Additional Language',
    'Afrikaans Home Language',
    'Afrikaans First Additional Language',
    'Mathematics',
    'Mathematical Literacy',
    'Life Sciences',
    'Physical Sciences',
    'Accounting',
    'Business Studies',
    'Economics',
    'Geography',
    'History',
    'Life Orientation',
    'Information Technology',
    'Computer Applications Technology',
    'Tourism',
  ],
};

export interface GradeComplexity {
  duration: string;
  marks: number;
  questionTypes: string;
  vocabulary: string;
  instructions: string;
  calculator: boolean;
  decimals: boolean;
}

export const GRADE_COMPLEXITY: Record<string, GradeComplexity> = {
  'grade_r': {
    duration: '20 minutes',
    marks: 10,
    questionTypes: 'Picture identification, matching, coloring, simple counting',
    vocabulary: 'Basic colors, shapes, numbers 1-5, simple animals',
    instructions: 'Use LOTS of visual cues, emojis, and simple one-word answers. NO writing required. Focus on recognition and matching.',
    calculator: false,
    decimals: false,
  },
  'grade_1': {
    duration: '30 minutes',
    marks: 20,
    questionTypes: 'Fill-in-the-blank with word bank, matching pictures to words, simple multiple choice (2-3 options), basic counting',
    vocabulary: 'Simple everyday words, numbers 1-10, basic family/animals/food vocabulary',
    instructions: 'Keep sentences SHORT (3-5 words max). Provide word banks for fill-in-blanks. Use pictures wherever possible.',
    calculator: false,
    decimals: false,
  },
  'grade_2': {
    duration: '45 minutes',
    marks: 30,
    questionTypes: 'Short answer (1-2 sentences), fill-in-blanks, multiple choice (3-4 options), simple problem solving',
    vocabulary: 'Expanded vocabulary, numbers 1-20, basic sentence construction',
    instructions: 'Simple paragraph reading (3-4 sentences). Basic grammar concepts.',
    calculator: false,
    decimals: false,
  },
  'grade_3': {
    duration: '60 minutes',
    marks: 40,
    questionTypes: 'Short paragraphs, multiple choice, true/false, matching, basic problem solving',
    vocabulary: 'Age-appropriate vocabulary, numbers 1-100, basic fractions (half, quarter)',
    instructions: 'Reading comprehension with short stories (1 paragraph). Introduction to simple essays.',
    calculator: false,
    decimals: false,
  },
  'grade_4': {
    duration: '90 minutes',
    marks: 50,
    questionTypes: 'Paragraphs, essays (5-7 sentences), multiple choice, problem solving, data interpretation',
    vocabulary: 'Grade-appropriate vocabulary, decimals to 1 place, basic fractions',
    instructions: 'Reading passages (2-3 paragraphs). Essay writing with structure. Basic calculator allowed.',
    calculator: true,
    decimals: true,
  },
  'grade_5': {
    duration: '90 minutes',
    marks: 60,
    questionTypes: 'Extended paragraphs, structured essays, complex problem solving, comprehension',
    vocabulary: 'Intermediate vocabulary, decimals to 2 places, common fractions',
    instructions: 'Multi-paragraph reading. Structured essays with introduction and conclusion.',
    calculator: true,
    decimals: true,
  },
  'grade_6': {
    duration: '90 minutes',
    marks: 75,
    questionTypes: 'Essays with clear structure, data analysis, multi-step problem solving',
    vocabulary: 'Advanced intermediate vocabulary, percentages, ratios, algebraic thinking',
    instructions: 'Complex reading comprehension. Essay writing with planning.',
    calculator: true,
    decimals: true,
  },
  'grade_7': {
    duration: '2 hours',
    marks: 75,
    questionTypes: 'Analytical essays, data interpretation, multi-step problems, reasoning',
    vocabulary: 'Grade 7 curriculum vocabulary, algebraic expressions, geometry',
    instructions: 'Extended reading passages. Structured analytical writing. Scientific calculator allowed.',
    calculator: true,
    decimals: true,
  },
  'grade_8': {
    duration: '2 hours',
    marks: 100,
    questionTypes: 'Analytical and creative writing, complex problem solving, research-based questions',
    vocabulary: 'Grade 8 curriculum, algebra, functions, advanced grammar',
    instructions: 'Critical thinking required. Extended essays with evidence.',
    calculator: true,
    decimals: true,
  },
  'grade_9': {
    duration: '2 hours',
    marks: 100,
    questionTypes: 'Critical analysis, extended essays, complex calculations, abstract reasoning',
    vocabulary: 'Grade 9 curriculum, quadratics, trigonometry basics, formal language',
    instructions: 'FET Phase preparation. Formal academic writing.',
    calculator: true,
    decimals: true,
  },
  'grade_10': {
    duration: '2.5 hours',
    marks: 100,
    questionTypes: 'FET formal exam format, extended responses, proofs, investigations',
    vocabulary: 'Grade 10 curriculum, advanced algebra, trigonometry, analytical writing',
    instructions: 'NSC preparation format. Extended essay responses.',
    calculator: true,
    decimals: true,
  },
  'grade_11': {
    duration: '3 hours',
    marks: 150,
    questionTypes: 'NSC format, research essays, complex multi-step problems, investigations',
    vocabulary: 'Grade 11 curriculum, calculus introduction, advanced topics',
    instructions: 'Full NSC exam format. University preparation.',
    calculator: true,
    decimals: true,
  },
  'grade_12': {
    duration: '3 hours',
    marks: 150,
    questionTypes: 'Full NSC Matric format, research essays, proofs, investigations, applications',
    vocabulary: 'Grade 12 curriculum, calculus, statistics, formal academic language',
    instructions: 'Official NSC Matric format. University-level expectations.',
    calculator: true,
    decimals: true,
  },
};

export interface ExamPrepConfig {
  grade: string;
  subject: string;
  examType: string;
  language: SouthAfricanLanguage;
  customPrompt?: string;
  enableInteractive?: boolean;
}

export interface GeneratedExam {
  id: string;
  config: ExamPrepConfig;
  content: string;
  generatedAt: Date;
  userId?: string;
}

// Helper to get phase from grade
export function getPhaseFromGrade(grade: string): keyof typeof SUBJECTS_BY_PHASE {
  if (['grade_r', 'grade_1', 'grade_2', 'grade_3'].includes(grade)) return 'foundation';
  if (['grade_4', 'grade_5', 'grade_6'].includes(grade)) return 'intermediate';
  if (['grade_7', 'grade_8', 'grade_9'].includes(grade)) return 'senior';
  return 'fet';
}

// Get subjects for a specific grade
export function getSubjectsForGrade(grade: string): string[] {
  const phase = getPhaseFromGrade(grade);
  return SUBJECTS_BY_PHASE[phase];
}
