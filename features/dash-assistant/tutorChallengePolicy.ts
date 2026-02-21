import type { LearnerContext } from '@/lib/dash-ai/learnerContext';
import { resolveAgeBand } from '@/lib/dash-ai/learnerContext';
import type { TutorMode } from '@/hooks/dash-assistant/tutorTypes';

type LearnerTier = 'preschool' | 'foundation' | 'intermediate' | 'senior';

interface TierChallengeBase {
  diagnosticQuestions: number;
  practiceQuestions: number;
  synthesisQuestions: number;
  spellingChallenges: number;
  playRounds: number;
}

export interface TutorChallengePolicyInput {
  mode: TutorMode;
  learnerContext?: LearnerContext | null;
  difficulty?: number | null;
  phonicsMode?: boolean;
}

export interface TutorChallengePlan {
  diagnosticQuestions: number;
  practiceQuestions: number;
  synthesisQuestions: number;
  spellingChallenges: number;
  playRounds: number;
  maxQuestions: number;
  learnerTier: LearnerTier;
}

const TIER_BASE: Record<LearnerTier, TierChallengeBase> = {
  preschool: {
    diagnosticQuestions: 2,
    practiceQuestions: 3,
    synthesisQuestions: 1,
    spellingChallenges: 2,
    playRounds: 4,
  },
  foundation: {
    diagnosticQuestions: 2,
    practiceQuestions: 4,
    synthesisQuestions: 1,
    spellingChallenges: 3,
    playRounds: 5,
  },
  intermediate: {
    diagnosticQuestions: 3,
    practiceQuestions: 5,
    synthesisQuestions: 2,
    spellingChallenges: 4,
    playRounds: 5,
  },
  senior: {
    diagnosticQuestions: 3,
    practiceQuestions: 6,
    synthesisQuestions: 2,
    spellingChallenges: 4,
    playRounds: 6,
  },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseGradeNumber = (grade?: string | null): number | null => {
  const raw = String(grade || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'r' || raw.includes('grade r')) return 0;
  const match = raw.match(/(\d{1,2})/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isNaN(parsed) ? null : parsed;
};

const inferLearnerTier = (learnerContext?: LearnerContext | null): LearnerTier => {
  const schoolType = String(learnerContext?.schoolType || '').toLowerCase();
  if (
    schoolType.includes('preschool') ||
    schoolType.includes('ecd') ||
    schoolType.includes('early')
  ) {
    return 'preschool';
  }

  const resolvedAgeBand =
    learnerContext?.ageBand ||
    resolveAgeBand(learnerContext?.ageYears || null, learnerContext?.grade || null);

  if (resolvedAgeBand === '3-5') return 'preschool';
  if (resolvedAgeBand === '6-8') return 'foundation';
  if (resolvedAgeBand === '9-12') return 'intermediate';
  if (resolvedAgeBand === '13-15' || resolvedAgeBand === '16-18') return 'senior';

  const gradeNumber = parseGradeNumber(learnerContext?.grade || null);
  if (gradeNumber === null) return 'intermediate';
  if (gradeNumber <= 1) return 'preschool';
  if (gradeNumber <= 3) return 'foundation';
  if (gradeNumber <= 8) return 'intermediate';
  return 'senior';
};

const getDifficultyDelta = (difficulty?: number | null) => {
  if (typeof difficulty !== 'number' || Number.isNaN(difficulty)) return 0;
  if (difficulty <= 2) return -1;
  if (difficulty >= 4) return 1;
  return 0;
};

export const getTutorChallengePlan = (input: TutorChallengePolicyInput): TutorChallengePlan => {
  const learnerTier = inferLearnerTier(input.learnerContext);
  const base = TIER_BASE[learnerTier];
  const delta = getDifficultyDelta(input.difficulty);

  const diagnosticQuestions = clamp(base.diagnosticQuestions + delta, 2, 4);
  const practiceQuestions = clamp(base.practiceQuestions + delta, 2, 8);
  const synthesisQuestions = clamp(base.synthesisQuestions + Math.max(0, delta), 1, 3);
  const spellingBase = input.phonicsMode ? base.spellingChallenges + 1 : base.spellingChallenges;
  const spellingChallenges = clamp(spellingBase + delta, 2, 6);
  const playRounds = clamp(base.playRounds + delta, 3, 8);

  let maxQuestions = 1;
  switch (input.mode) {
    case 'diagnostic':
      maxQuestions = diagnosticQuestions;
      break;
    case 'practice':
      maxQuestions = practiceQuestions;
      break;
    case 'quiz':
      maxQuestions = clamp(practiceQuestions + synthesisQuestions, 3, 9);
      break;
    case 'play':
      maxQuestions = playRounds;
      break;
    case 'explain':
    default:
      maxQuestions = 1;
      break;
  }

  return {
    diagnosticQuestions,
    practiceQuestions,
    synthesisQuestions,
    spellingChallenges,
    playRounds,
    maxQuestions,
    learnerTier,
  };
};

