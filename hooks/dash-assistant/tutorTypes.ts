export type TutorMode = 'diagnostic' | 'practice' | 'quiz' | 'explain' | 'play';
export type PhonicsStage = 'letter_sounds' | 'cvc_blending' | 'rhyming' | 'segmenting';

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
  /** Parent-enforced supportive pacing profile */
  slowLearner?: boolean;
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
  /** Phonics teaching mode for preschool literacy flow */
  phonicsMode?: boolean;
  /** Current phonics progression stage */
  phonicsStage?: PhonicsStage | null;
  /** Recently mastered sounds/words for stage progression */
  phonicsMastered?: string[];
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
  /** CAPS curriculum content area or topic ID when aligned */
  caps_content_area?: string;
};
