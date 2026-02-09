import type {
  ActivityOption,
  ActivityRound,
  PreschoolActivity,
  PreschoolDifficulty,
} from './preschoolActivities.types';

export type PlaygroundDifficultyLevel = PreschoolDifficulty;

const EASY_MAX_ROUNDS = 4;
const EASY_MAX_OPTIONS = 3;
const TRICKY_TARGET_OPTIONS = 4;
const TRICKY_HINT_ATTEMPTS = 2;

const FALLBACK_DISTRACTORS = ['Other', 'Try this', 'Maybe this', 'Not sure'];

const cloneActivity = (activity: PreschoolActivity): PreschoolActivity =>
  JSON.parse(JSON.stringify(activity)) as PreschoolActivity;

const parseNumericLabels = (options: ActivityOption[]): number[] => {
  const parsed = options.map((opt) => Number.parseInt(opt.label, 10));
  return parsed.every((value) => Number.isFinite(value)) ? parsed : [];
};

const ensureCorrectOption = (options: ActivityOption[]): ActivityOption[] => {
  if (options.some((opt) => opt.isCorrect)) return options;
  if (options.length === 0) return options;
  return [{ ...options[0], isCorrect: true }, ...options.slice(1)];
};

const clampOptions = (options: ActivityOption[], maxOptions: number): ActivityOption[] => {
  if (options.length <= maxOptions) return options;
  const safe = ensureCorrectOption(options);
  const correct = safe.find((opt) => opt.isCorrect);
  const wrong = safe.filter((opt) => !opt.isCorrect);
  if (!correct) return safe.slice(0, maxOptions);
  return [correct, ...wrong.slice(0, Math.max(0, maxOptions - 1))];
};

const buildDistractor = (options: ActivityOption[], roundIndex: number): ActivityOption => {
  const numeric = parseNumericLabels(options);
  if (numeric.length > 0) {
    let candidate = Math.max(...numeric) + 1;
    while (numeric.includes(candidate)) candidate += 1;
    return {
      id: `auto-num-${roundIndex}-${candidate}`,
      label: String(candidate),
      isCorrect: false,
    };
  }

  let candidate =
    FALLBACK_DISTRACTORS[(roundIndex + options.length) % FALLBACK_DISTRACTORS.length];
  let suffix = 1;
  const labels = new Set(options.map((opt) => opt.label));
  while (labels.has(candidate)) {
    candidate = `${FALLBACK_DISTRACTORS[(roundIndex + suffix) % FALLBACK_DISTRACTORS.length]} ${suffix}`;
    suffix += 1;
  }

  return {
    id: `auto-opt-${roundIndex}-${options.length + 1}`,
    label: candidate,
    isCorrect: false,
  };
};

const withEasyDifficulty = (round: ActivityRound): ActivityRound => {
  if (!round.options || round.confirmOnly) return round;
  const options = clampOptions(round.options, EASY_MAX_OPTIONS);
  return {
    ...round,
    options,
    minWrongForHint: 1,
  };
};

const withTrickyDifficulty = (round: ActivityRound, roundIndex: number): ActivityRound => {
  if (!round.options || round.confirmOnly) return round;

  let options = clampOptions(round.options, TRICKY_TARGET_OPTIONS);
  while (options.length < TRICKY_TARGET_OPTIONS) {
    options = [...options, buildDistractor(options, roundIndex)];
  }

  return {
    ...round,
    options,
    minWrongForHint: TRICKY_HINT_ATTEMPTS,
  };
};

export const mapPlaygroundDifficultyToLevel = (difficulty: PlaygroundDifficultyLevel): number => {
  if (difficulty === 'easy') return 1;
  if (difficulty === 'tricky') return 3;
  return 2;
};

export function buildPlaygroundVariant(
  baseActivity: PreschoolActivity,
  level: PlaygroundDifficultyLevel,
): PreschoolActivity {
  const activity = cloneActivity(baseActivity);

  if (level === 'easy') {
    return {
      ...activity,
      difficulty: 'easy',
      rounds: activity.rounds.slice(0, EASY_MAX_ROUNDS).map(withEasyDifficulty),
    };
  }

  if (level === 'tricky') {
    return {
      ...activity,
      difficulty: 'tricky',
      rounds: activity.rounds.map((round, index) => withTrickyDifficulty(round, index)),
    };
  }

  return {
    ...activity,
    difficulty: 'medium',
    rounds: activity.rounds.map((round) => ({ ...round })),
  };
}
