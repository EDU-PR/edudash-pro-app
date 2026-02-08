export type TierKey = 'free' | 'starter' | 'plus';

export type Direction = 'up' | 'right' | 'down' | 'left';

export type StepValidationMode =
  | 'default'
  | 'robot_path_to_goal'
  | 'move_count_from_path';

export interface GridCoord {
  row: number;
  col: number;
}

export interface PathBoard {
  rows: number;
  cols: number;
  start: GridCoord;
  goal: GridCoord;
  obstacles?: GridCoord[];
}

export interface StepOption {
  id: string;
  label: string;
  value?: string;
  sequence?: Direction[];
  isCorrect?: boolean;
}

export interface ActivityStep {
  id: string;
  title: string;
  prompt: string;
  options?: StepOption[];
  confirmOnly?: boolean;
  validation?: StepValidationMode;
  board?: PathBoard;
  hint?: string;
}

export interface ActivityCard {
  id: string;
  title: string;
  subtitle: string;
  duration: string;
  tags: string[];
  accent: string;
  gradient: [string, string];
  requiresTier?: TierKey;
  aiPrompt?: string;
  steps: ActivityStep[];
  isLesson?: boolean;
}

export interface PathSimulationResult {
  visited: GridCoord[];
  final: GridCoord;
  reachedGoal: boolean;
  blocked: boolean;
  outOfBounds: boolean;
  blockedAtStep?: number;
  message: string;
}

const DIRECTION_TO_ARROW: Record<Direction, string> = {
  up: '⬆️',
  right: '➡️',
  down: '⬇️',
  left: '⬅️',
};

const DIRECTION_DELTA: Record<Direction, [number, number]> = {
  up: [-1, 0],
  right: [0, 1],
  down: [1, 0],
  left: [0, -1],
};

export const TIER_LIMITS: Record<TierKey, { lessons: number; activities: number; aiHints: number }> = {
  free: { lessons: 1, activities: 3, aiHints: 5 },
  starter: { lessons: 3, activities: 8, aiHints: 20 },
  plus: {
    lessons: Number.POSITIVE_INFINITY,
    activities: Number.POSITIVE_INFINITY,
    aiHints: Number.POSITIVE_INFINITY,
  },
};

const toKey = (coord: GridCoord) => `${coord.row}:${coord.col}`;

const sameCoord = (a: GridCoord, b: GridCoord) => a.row === b.row && a.col === b.col;

export const formatSequence = (sequence: Direction[] = []): string =>
  sequence.map((item) => DIRECTION_TO_ARROW[item]).join(' ');

export const simulateRobotPath = (board: PathBoard, sequence: Direction[] = []): PathSimulationResult => {
  const obstacles = new Set((board.obstacles || []).map(toKey));
  const visited: GridCoord[] = [{ ...board.start }];
  let current: GridCoord = { ...board.start };

  for (let index = 0; index < sequence.length; index += 1) {
    const direction = sequence[index];
    const [rowDelta, colDelta] = DIRECTION_DELTA[direction];
    const next = { row: current.row + rowDelta, col: current.col + colDelta };

    if (next.row < 0 || next.row >= board.rows || next.col < 0 || next.col >= board.cols) {
      return {
        visited,
        final: current,
        reachedGoal: false,
        blocked: false,
        outOfBounds: true,
        blockedAtStep: index + 1,
        message: 'That route leaves the map. Try to stay inside the grid.',
      };
    }

    if (obstacles.has(toKey(next))) {
      return {
        visited,
        final: current,
        reachedGoal: false,
        blocked: true,
        outOfBounds: false,
        blockedAtStep: index + 1,
        message: 'Robo bumped into a blocked square. Choose a safer path.',
      };
    }

    current = next;
    visited.push({ ...current });
  }

  const reachedGoal = sameCoord(current, board.goal);

  return {
    visited,
    final: current,
    reachedGoal,
    blocked: false,
    outOfBounds: false,
    message: reachedGoal
      ? 'Perfect path! Robo reached the star.'
      : 'Robo did not reach the star yet. Try another arrow route.',
  };
};

const robotBoard: PathBoard = {
  rows: 3,
  cols: 3,
  start: { row: 2, col: 0 },
  goal: { row: 0, col: 2 },
  obstacles: [
    { row: 1, col: 0 },
    { row: 1, col: 1 },
  ],
};

const robotPathOptions: StepOption[] = [
  { id: 'path-a', sequence: ['up', 'right', 'right', 'up'], label: formatSequence(['up', 'right', 'right', 'up']) },
  { id: 'path-b', sequence: ['right', 'right', 'up', 'up'], label: formatSequence(['right', 'right', 'up', 'up']) },
  { id: 'path-c', sequence: ['right', 'up', 'right', 'up'], label: formatSequence(['right', 'up', 'right', 'up']) },
];

export const PRESCHOOL_HUB_ACTIVITIES: ActivityCard[] = [
  {
    id: 'robot_pathfinder',
    title: 'Robot Pathfinder',
    subtitle: 'Guide Robo to the star with the right arrow path.',
    duration: '6 min',
    tags: ['Logic', 'Sequencing', 'Robotics'],
    accent: '#2563EB',
    gradient: ['#1D4ED8', '#3B82F6'],
    isLesson: true,
    aiPrompt: 'Create one more playful sequencing challenge for a preschooler using arrows and a robot story.',
    steps: [
      {
        id: 'path-choice',
        title: 'Choose the Path',
        prompt: 'Pick the arrow route that takes Robo from the flag to the star.',
        options: robotPathOptions,
        board: robotBoard,
        validation: 'robot_path_to_goal',
        hint: 'Look at blocked squares first. Robo cannot move through them.',
      },
      {
        id: 'path-count',
        title: 'Count the Moves',
        prompt: 'How many moves did Robo use to reach the star?',
        options: [
          { id: 'moves-3', value: '3', label: '3' },
          { id: 'moves-4', value: '4', label: '4' },
          { id: 'moves-5', value: '5', label: '5' },
        ],
        validation: 'move_count_from_path',
        hint: 'Count each arrow in the winning route.',
      },
      {
        id: 'robot-high-five',
        title: 'Robot High-Five',
        prompt: 'Give your child a robot high-five and say, "Great sequencing!" then tap Done.',
        confirmOnly: true,
      },
    ],
  },
  {
    id: 'ai_sound_lab',
    title: 'AI Sound Lab',
    subtitle: 'Match sounds to smart sensors.',
    duration: '5 min',
    tags: ['Listening', 'Focus', 'AI'],
    accent: '#7C3AED',
    gradient: ['#6D28D9', '#8B5CF6'],
    requiresTier: 'starter',
    aiPrompt: 'Suggest a playful sound-matching activity for a preschooler with a robot theme.',
    steps: [
      {
        id: 'sound-match',
        title: 'Sound Match',
        prompt: 'Which sound would a friendly robot make?',
        options: [
          { id: 'sound-a', label: 'Beep-boop', isCorrect: true },
          { id: 'sound-b', label: 'Meow', isCorrect: false },
          { id: 'sound-c', label: 'Splash', isCorrect: false },
        ],
        validation: 'default',
      },
      {
        id: 'sensor-check',
        title: 'Sensor Check',
        prompt: 'Which object can help us detect light?',
        options: [
          { id: 'sensor-a', label: 'Flashlight', isCorrect: true },
          { id: 'sensor-b', label: 'Pillow', isCorrect: false },
          { id: 'sensor-c', label: 'Spoon', isCorrect: false },
        ],
      },
      {
        id: 'real-world-try',
        title: 'Home Try',
        prompt: 'Find one light source at home together, then tap Done.',
        confirmOnly: true,
      },
    ],
  },
  {
    id: 'rocket_math',
    title: 'Rocket Count Down',
    subtitle: 'Launch with the right countdown sequence.',
    duration: '4 min',
    tags: ['Numbers', 'Rhythm', 'Space'],
    accent: '#F97316',
    gradient: ['#EA580C', '#F97316'],
    steps: [
      {
        id: 'countdown-sequence',
        title: 'Count Down',
        prompt: 'Pick the sequence that launches the rocket correctly.',
        options: [
          { id: 'rocket-a', label: '3, 2, 1, GO', isCorrect: true },
          { id: 'rocket-b', label: '1, 2, 3, GO', isCorrect: false },
          { id: 'rocket-c', label: '2, 1, 3, GO', isCorrect: false },
        ],
      },
      {
        id: 'rocket-stretch',
        title: 'Rocket Stretch',
        prompt: 'Stretch up like a rocket and say "blast off", then tap Done.',
        confirmOnly: true,
      },
    ],
  },
  {
    id: 'robot_builder',
    title: 'Build-a-Bot',
    subtitle: 'Pick shapes to build a simple robot.',
    duration: '7 min',
    tags: ['Shapes', 'Creativity', 'Robotics'],
    accent: '#0EA5E9',
    gradient: ['#0284C7', '#38BDF8'],
    requiresTier: 'plus',
    aiPrompt: 'Create one extra preschool robot-building shape challenge with home materials.',
    steps: [
      {
        id: 'pick-head',
        title: 'Pick the Head Shape',
        prompt: 'Which shape works best for the robot head?',
        options: [
          { id: 'head-a', label: 'Circle', isCorrect: true },
          { id: 'head-b', label: 'Triangle', isCorrect: false },
          { id: 'head-c', label: 'Star', isCorrect: false },
        ],
      },
      {
        id: 'pick-body',
        title: 'Pick the Body Shape',
        prompt: 'Which shape looks most like a robot body?',
        options: [
          { id: 'body-a', label: 'Rectangle', isCorrect: true },
          { id: 'body-b', label: 'Heart', isCorrect: false },
          { id: 'body-c', label: 'Diamond', isCorrect: false },
        ],
      },
      {
        id: 'build-home',
        title: 'Build at Home',
        prompt: 'Use paper or blocks to build your robot, then tap Done.',
        confirmOnly: true,
      },
    ],
  },
];
