/**
 * Daily Exercise Routine – shared types.
 *
 * Consumed by hooks (`@/hooks/daily-exercises`) and UI components.
 */

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'adaptive';
/** Alias used by hooks */
export type ExerciseDifficulty = DifficultyLevel;

export type ExerciseStatus = 'pending' | 'in_progress' | 'completed';

export type SubjectCode =
  | 'mathematics'
  | 'english_hl'
  | 'afrikaans_hl'
  | 'afrikaans_fal'
  | 'isizulu_hl'
  | 'isizulu_fal';
/** Alias used by hooks */
export type ExerciseSubject = SubjectCode;

export interface SubjectConfig {
  code: SubjectCode;
  label: string;
  enabled: boolean;
}

export interface DailyExerciseConfig {
  id: string;
  studentId: string;
  parentId?: string;
  organizationId?: string;
  grade?: string;
  subjects: SubjectConfig[];
  coreSubjects?: SubjectCode[];
  optionalSubjects?: SubjectCode[];
  questionsPerSubject: number;
  difficulty: DifficultyLevel;
  reminderEnabled: boolean;
  reminderTime: string;
  reminderDays: boolean[] | number[];
  alertEnabled?: boolean;
  alertTime?: string;
  alertDays?: number[];
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseQuestion {
  id: string;
  subjectCode?: SubjectCode;
  questionText: string;
  questionType: 'multiple_choice' | 'fill_blank' | 'true_false';
  options?: string[];
  correctAnswer: string;
  explanation: string;
  hasLatex?: boolean;
  studentAnswer?: string;
}

export interface SubjectExercise {
  subjectCode: SubjectCode;
  subjectLabel: string;
  status: ExerciseStatus;
  questions: ExerciseQuestion[];
  score?: number;
  correctCount?: number;
  totalQuestions: number;
  completedAt?: string;
  timeSpentSeconds?: number;
}

/** Per-subject daily exercise (DB-backed, used by hooks) */
export interface DailyExercise {
  id: string;
  configId: string;
  studentId: string;
  date: string;
  subject: ExerciseSubject;
  grade: string;
  questions: ExerciseQuestion[];
  status: ExerciseStatus;
  score?: number;
  correctCount?: number;
  totalQuestions: number;
  startedAt?: string;
  completedAt?: string;
  timeSpentSeconds?: number;
}

export interface DailyExerciseSet {
  id: string;
  studentId: string;
  date: string;
  subjects: SubjectExercise[];
  overallStatus: ExerciseStatus;
  overallScore?: number;
  completedSubjects: number;
  totalSubjects: number;
}

export interface ExerciseStreak {
  current: number;
  best: number;
  totalDays: number;
}

export interface DayProgress {
  date: string;
  status: 'completed' | 'partial' | 'missed' | 'pending';
  score?: number;
}

export interface SubjectAverage {
  subjectCode: SubjectCode;
  subjectLabel: string;
  averageScore: number;
  totalAttempts: number;
}

export interface DailyExerciseProgress {
  studentId?: string;
  currentStreak?: number;
  bestStreak?: number;
  totalDaysCompleted?: number;
  totalQuestionsAnswered?: number;
  totalCorrect?: number;
  averageScore?: number;
  weekActivity?: boolean[];
  subjectScores?: Record<ExerciseSubject, { attempts: number; avgScore: number }>;
  lastCompletedDate?: string;
  streak: ExerciseStreak;
  weekProgress: DayProgress[];
  subjectAverages: SubjectAverage[];
  recentExercises: DailyExerciseSet[];
  insight?: string;
}

export const DEFAULT_QUESTIONS_PER_SUBJECT = 5;
export const DEFAULT_ALERT_DAYS = [1, 2, 3, 4, 5];

export const SUBJECT_OPTIONS: SubjectConfig[] = [
  { code: 'mathematics', label: 'Mathematics', enabled: true },
  { code: 'english_hl', label: 'English HL', enabled: true },
  { code: 'afrikaans_hl', label: 'Afrikaans HL', enabled: false },
  { code: 'afrikaans_fal', label: 'Afrikaans FAL', enabled: false },
  { code: 'isizulu_hl', label: 'isiZulu HL', enabled: false },
  { code: 'isizulu_fal', label: 'isiZulu FAL', enabled: false },
];

export const QUESTIONS_PER_SUBJECT_OPTIONS = [3, 5, 7, 10] as const;

export const DIFFICULTY_OPTIONS: { value: DifficultyLevel; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'adaptive', label: 'Adaptive (recommended)' },
];

export const SUBJECT_LABELS: Record<SubjectCode, string> = {
  mathematics: 'Mathematics',
  english_hl: 'English HL',
  afrikaans_hl: 'Afrikaans HL',
  afrikaans_fal: 'Afrikaans FAL',
  isizulu_hl: 'isiZulu HL',
  isizulu_fal: 'isiZulu FAL',
};
