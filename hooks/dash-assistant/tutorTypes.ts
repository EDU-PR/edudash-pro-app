export type TutorMode = 'diagnostic' | 'practice' | 'quiz' | 'explain' | 'play';

/** Preschool-specific play activities Dash can run in conversation */
export type PreschoolPlayType =
  | 'counting_game'
  | 'colour_quiz'
  | 'shape_hunt'
  | 'rhyme_time'
  | 'story_time'
  | 'animal_sounds'
  | 'letter_fun'
  | 'silly_questions';

export type TutorSession = {
  id: string;
  mode: TutorMode;
  subject?: string | null;
  grade?: string | null;
  topic?: string | null;
  awaitingAnswer: boolean;
  currentQuestion?: string | null;
  expectedAnswer?: string | null;
  questionIndex: number;
  totalQuestions: number;
  correctCount: number;
  maxQuestions: number;
  difficulty: number;
  incorrectStreak: number;
  correctStreak: number;
  attemptsOnQuestion: number;
  /** Preschool play type when mode === 'play' */
  playType?: PreschoolPlayType | null;
  /** Whether voice mode is active (kid-friendly ORB) */
  voiceActive?: boolean;
};

export type TutorPayload = {
  question?: string;
  expected_answer?: string;
  subject?: string;
  grade?: string;
  topic?: string;
  difficulty?: number;
  next_step?: 'answer' | 'need_context';
  is_correct?: boolean;
  score?: number;
  feedback?: string;
  correct_answer?: string;
  explanation?: string;
  misconception?: string;
  follow_up_question?: string;
  next_expected_answer?: string;
  hint?: string;
  steps?: string;
};
