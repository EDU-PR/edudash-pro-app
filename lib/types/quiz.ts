/**
 * Quiz & Interactive Learning Types
 *
 * Types for the Dash AI quiz generation, session management,
 * spaced repetition, and achievement tracking systems.
 */

// ============================================
// Question Types
// ============================================

export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'fill_blank'
  | 'matching'
  | 'letter_sound_match'
  | 'rhyme_match'
  | 'blend_word'
  | 'vowel_identify';
export type QuizDifficulty = 'easy' | 'medium' | 'hard' | 'challenge';
export type SkillLevel = 'beginner' | 'developing' | 'proficient' | 'advanced' | 'mastery';
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned' | 'timed_out';
export type AchievementCategory = 'quiz_mastery' | 'streak' | 'exploration' | 'speed' | 'general';
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type AchievementRequirement = 'quiz_score' | 'streak_days' | 'topics_mastered' | 'questions_answered' | 'perfect_quiz' | 'speed_run';

export interface QuizQuestionOption {
  label: string;
  value: string;
}

export interface MatchingPair {
  left: string;
  right: string;
}

export interface QuizQuestion {
  id: string;
  subject: string;
  topic: string;
  grade_level: string;
  difficulty: QuizDifficulty;
  question_type: QuestionType;
  question_text: string;
  correct_answer: string;
  options: QuizQuestionOption[] | MatchingPair[];
  explanation: string | null;
  hints: string[];
  caps_aligned: boolean;
  language: string;
  metadata: Record<string, unknown>;
}

export interface QuizSession {
  id: string;
  user_id: string;
  organization_id: string | null;
  subject: string;
  topic: string;
  grade_level: string | null;
  difficulty: QuizDifficulty;
  question_ids: string[];
  current_question_index: number;
  score: number;
  total_questions: number;
  correct_answers: number;
  incorrect_answers: number;
  hints_used: number;
  time_spent_seconds: number;
  status: SessionStatus;
  started_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
}

export interface QuizAnswer {
  id: string;
  session_id: string;
  question_id: string;
  user_answer: string;
  is_correct: boolean;
  hints_used: number;
  time_taken_seconds: number;
  answered_at: string;
}

// ============================================
// Learning Progress
// ============================================

export interface LearningProgress {
  id: string;
  user_id: string;
  organization_id: string | null;
  subject: string;
  topic: string;
  grade_level: string | null;
  skill_level: SkillLevel;
  mastery_score: number;
  total_attempts: number;
  correct_count: number;
  incorrect_count: number;
  streak_current: number;
  streak_best: number;
  last_activity_at: string | null;
}

// ============================================
// Achievements
// ============================================

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  requirement_type: AchievementRequirement;
  requirement_value: number;
  requirement_subject: string | null;
  tier: AchievementTier;
  xp_reward: number;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  earned_at: string;
  metadata: Record<string, unknown>;
  achievement?: Achievement;
}

// ============================================
// Spaced Repetition (SM-2)
// ============================================

export interface ReviewSchedule {
  id: string;
  user_id: string;
  question_id: string;
  ease_factor: number;
  repetitions: number;
  interval_days: number;
  next_review_date: string;
  last_reviewed_at: string | null;
  quality_history: number[];
}

// ============================================
// Quiz Configuration (input to quiz generation)
// ============================================

export interface QuizConfig {
  subject: string;
  topic: string;
  gradeLevel: string;
  difficulty: QuizDifficulty;
  questionCount: number;
  questionTypes: QuestionType[];
  language?: string;
  capsAligned?: boolean;
  /** Optionally include specific questions (for review sessions) */
  includeQuestionIds?: string[];
  /** Time limit in seconds (0 = no limit) */
  timeLimitSeconds?: number;
}

export interface QuizGenerationResult {
  questions: QuizQuestion[];
  sessionId: string;
  totalQuestions: number;
  estimatedTime: number;
}

export interface AnswerResult {
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string | null;
  hintsAvailable: number;
  nextQuestionIndex: number | null;
  sessionProgress: {
    current: number;
    total: number;
    score: number;
    correctSoFar: number;
  };
}

export interface SessionResult {
  sessionId: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  hintsUsed: number;
  timeSpentSeconds: number;
  masteryDelta: number;
  newSkillLevel: SkillLevel | null;
  achievementsEarned: Achievement[];
  reviewQuestions: string[];
}

// ============================================
// AI Response shape (parsed from Claude)
// ============================================

export interface AIQuizResponse {
  questions: Array<{
    question_type: QuestionType;
    question_text: string;
    correct_answer: string;
    options?: Array<{ label: string; value: string }>;
    matching_pairs?: Array<{ left: string; right: string }>;
    explanation: string;
    hints: string[];
    difficulty: QuizDifficulty;
  }>;
}
