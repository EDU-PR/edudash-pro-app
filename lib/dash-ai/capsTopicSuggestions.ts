/**
 * capsTopicSuggestions.ts
 *
 * Provides grade-specific CAPS (Curriculum and Assessment Policy Statement)
 * topic suggestions for the Dash Tutor.  Each suggestion includes a
 * Socratic-method prompt that diagnoses the learner's understanding first
 * before teaching, matching the Dash pedagogical approach.
 *
 * Phases follow the South African CAPS structure:
 * - Foundation Phase: Grades R–3
 * - Intermediate Phase: Grades 4–6
 * - Senior Phase: Grades 7–9
 * - FET Phase: Grades 10–12
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TopicSuggestion {
  id: string;
  label: string;
  subject: string;
  prompt: string;
  /** Ionicons icon name */
  icon: string;
  phase: 'foundation' | 'intermediate' | 'senior' | 'fet';
}

export type CAPSPhase = TopicSuggestion['phase'];

// ─── Grade → Phase mapping ───────────────────────────────────────────────────

function gradeToPhase(grade: string): CAPSPhase {
  const g = grade.toUpperCase().replace(/\s+/g, '');
  if (g === 'R' || g === '0' || g === 'GRADER' || g === 'GRADE0') return 'foundation';
  const num = parseInt(g.replace(/\D/g, ''), 10);
  if (Number.isNaN(num)) return 'foundation';
  if (num <= 3) return 'foundation';
  if (num <= 6) return 'intermediate';
  if (num <= 9) return 'senior';
  return 'fet';
}

// ─── Socratic prompt helper ──────────────────────────────────────────────────

function socratic(subject: string, topic: string, detail: string): string {
  return [
    `Let's explore ${topic} in ${subject} together.`,
    `First, I'll ask you a few quick questions to see what you already know — no pressure, just figuring out where to start.`,
    detail,
    `Once I understand your level, I'll guide you step-by-step with hints instead of just giving answers.`,
    `Ready? Let's begin!`,
  ].join(' ');
}

// ─── Topic banks per phase ───────────────────────────────────────────────────

const FOUNDATION_TOPICS: TopicSuggestion[] = [
  {
    id: 'fnd-number-concepts',
    label: 'Number Concepts',
    subject: 'Mathematics',
    icon: 'calculator-outline',
    phase: 'foundation',
    prompt: socratic(
      'Mathematics',
      'Number Concepts',
      'We\'ll start with counting and number recognition, then move to ordering numbers, comparing quantities, and understanding place value up to 1 000.',
    ),
  },
  {
    id: 'fnd-patterns',
    label: 'Patterns & Sorting',
    subject: 'Mathematics',
    icon: 'grid-outline',
    phase: 'foundation',
    prompt: socratic(
      'Mathematics',
      'Patterns',
      'I\'ll show you simple patterns with shapes and numbers and ask you to spot what comes next. We\'ll work up to creating your own patterns.',
    ),
  },
  {
    id: 'fnd-addition-subtraction',
    label: 'Addition & Subtraction',
    subject: 'Mathematics',
    icon: 'add-circle-outline',
    phase: 'foundation',
    prompt: socratic(
      'Mathematics',
      'Addition and Subtraction',
      'We\'ll practise adding and taking away numbers using fun real-life problems. I\'ll check if you can count on and count back first.',
    ),
  },
  {
    id: 'fnd-phonics',
    label: 'Phonics & Letter Sounds',
    subject: 'English Home Language',
    icon: 'musical-notes-outline',
    phase: 'foundation',
    prompt: socratic(
      'English',
      'Phonics',
      'Let\'s start with letter sounds. I\'ll say a sound and you tell me the letter, then we\'ll try blending sounds into words like c-a-t.',
    ),
  },
  {
    id: 'fnd-reading',
    label: 'Reading Comprehension',
    subject: 'English Home Language',
    icon: 'book-outline',
    phase: 'foundation',
    prompt: socratic(
      'English',
      'Reading Comprehension',
      'I\'ll share a short story and then ask you questions about what happened, who was in the story, and what you think might happen next.',
    ),
  },
  {
    id: 'fnd-life-skills',
    label: 'Life Skills & Healthy Living',
    subject: 'Life Skills',
    icon: 'heart-outline',
    phase: 'foundation',
    prompt: socratic(
      'Life Skills',
      'Healthy Living',
      'Let\'s talk about keeping healthy! I\'ll ask what you know about good food, exercise, and staying safe, then we\'ll learn more together.',
    ),
  },
  {
    id: 'fnd-shapes',
    label: '2D Shapes & Space',
    subject: 'Mathematics',
    icon: 'shapes-outline',
    phase: 'foundation',
    prompt: socratic(
      'Mathematics',
      'Shapes and Space',
      'Can you name some shapes you see around you? We\'ll explore circles, squares, triangles and rectangles and learn about their properties.',
    ),
  },
  {
    id: 'fnd-measurement',
    label: 'Measurement & Time',
    subject: 'Mathematics',
    icon: 'time-outline',
    phase: 'foundation',
    prompt: socratic(
      'Mathematics',
      'Measurement and Time',
      'I\'ll check if you can tell the time on a clock and measure things using informal units, then we\'ll practise together.',
    ),
  },
];

const INTERMEDIATE_TOPICS: TopicSuggestion[] = [
  {
    id: 'int-fractions',
    label: 'Fractions & Decimals',
    subject: 'Mathematics',
    icon: 'pie-chart-outline',
    phase: 'intermediate',
    prompt: socratic(
      'Mathematics',
      'Fractions and Decimals',
      'Let\'s see how well you understand parts of a whole. I\'ll start with simple fractions, check equivalence, and then connect fractions to decimals.',
    ),
  },
  {
    id: 'int-data-handling',
    label: 'Data Handling',
    subject: 'Mathematics',
    icon: 'bar-chart-outline',
    phase: 'intermediate',
    prompt: socratic(
      'Mathematics',
      'Data Handling',
      'Can you read a bar graph? We\'ll start there, then move to collecting data, drawing graphs, and answering questions about what the data shows.',
    ),
  },
  {
    id: 'int-grammar',
    label: 'Grammar & Comprehension',
    subject: 'English Home Language',
    icon: 'text-outline',
    phase: 'intermediate',
    prompt: socratic(
      'English',
      'Grammar and Comprehension',
      'I\'ll give you a paragraph and ask about nouns, verbs, adjectives, and what the passage means. We\'ll work through tenses and sentence construction.',
    ),
  },
  {
    id: 'int-natural-sciences',
    label: 'Natural Sciences Experiments',
    subject: 'Natural Sciences & Technology',
    icon: 'flask-outline',
    phase: 'intermediate',
    prompt: socratic(
      'Natural Sciences',
      'Scientific Investigation',
      'What do you know about fair tests and experiments? I\'ll walk you through the scientific method — hypothesis, method, observation, and conclusion.',
    ),
  },
  {
    id: 'int-history',
    label: 'History Timelines',
    subject: 'Social Sciences',
    icon: 'hourglass-outline',
    phase: 'intermediate',
    prompt: socratic(
      'History',
      'Historical Timelines',
      'Let\'s build a timeline! I\'ll ask you about key events in South African history and we\'ll place them in order to see the bigger picture.',
    ),
  },
  {
    id: 'int-multiplication',
    label: 'Multiplication & Division',
    subject: 'Mathematics',
    icon: 'close-circle-outline',
    phase: 'intermediate',
    prompt: socratic(
      'Mathematics',
      'Multiplication and Division',
      'How well do you know your times tables? We\'ll start with basic recall, then solve word problems using multiplication and division strategies.',
    ),
  },
  {
    id: 'int-geography',
    label: 'Maps & Geography',
    subject: 'Social Sciences',
    icon: 'globe-outline',
    phase: 'intermediate',
    prompt: socratic(
      'Geography',
      'Maps and Direction',
      'Can you read a simple map? We\'ll explore compass directions, keys, scales, and then look at South Africa\'s provinces and physical features.',
    ),
  },
  {
    id: 'int-creative-writing',
    label: 'Creative Writing',
    subject: 'English Home Language',
    icon: 'pencil-outline',
    phase: 'intermediate',
    prompt: socratic(
      'English',
      'Creative Writing',
      'Let\'s write a story! First I\'ll check your understanding of story structure — beginning, middle, end — then we\'ll plan and draft together.',
    ),
  },
];

const SENIOR_TOPICS: TopicSuggestion[] = [
  {
    id: 'snr-algebra',
    label: 'Algebra & Equations',
    subject: 'Mathematics',
    icon: 'code-slash-outline',
    phase: 'senior',
    prompt: socratic(
      'Mathematics',
      'Algebra',
      'Let me check your comfort with variables and expressions first. Then we\'ll solve linear equations, simplify expressions, and tackle word problems algebraically.',
    ),
  },
  {
    id: 'snr-geometry',
    label: 'Geometry & Measurement',
    subject: 'Mathematics',
    icon: 'triangle-outline',
    phase: 'senior',
    prompt: socratic(
      'Mathematics',
      'Geometry',
      'We\'ll start with angle relationships, then move to properties of triangles and quadrilaterals, and finish with area, perimeter and volume calculations.',
    ),
  },
  {
    id: 'snr-essay-writing',
    label: 'Essay Writing',
    subject: 'English Home Language',
    icon: 'document-text-outline',
    phase: 'senior',
    prompt: socratic(
      'English',
      'Essay Writing',
      'Let\'s build a strong essay. I\'ll first check your thesis-writing skills, then we\'ll work on paragraphing, argumentation, linking words, and conclusions.',
    ),
  },
  {
    id: 'snr-physical-sciences',
    label: 'Physical Sciences',
    subject: 'Natural Sciences',
    icon: 'magnet-outline',
    phase: 'senior',
    prompt: socratic(
      'Physical Sciences',
      'Forces and Energy',
      'What do you know about forces, motion, and energy? I\'ll diagnose your understanding and then guide you through key concepts with worked examples.',
    ),
  },
  {
    id: 'snr-biology',
    label: 'Life Sciences (Biology)',
    subject: 'Natural Sciences',
    icon: 'leaf-outline',
    phase: 'senior',
    prompt: socratic(
      'Life Sciences',
      'Cells and Systems',
      'Let\'s explore cells, tissues, and body systems. I\'ll check what you remember about cell structure first, then we\'ll connect it to how organs work.',
    ),
  },
  {
    id: 'snr-ems',
    label: 'Economic Management Sciences',
    subject: 'EMS',
    icon: 'cash-outline',
    phase: 'senior',
    prompt: socratic(
      'EMS',
      'Budgets and the Economy',
      'Do you know the difference between income and expenses? We\'ll start with personal budgets, then explore supply & demand, and basic accounting.',
    ),
  },
  {
    id: 'snr-data-probability',
    label: 'Data & Probability',
    subject: 'Mathematics',
    icon: 'stats-chart-outline',
    phase: 'senior',
    prompt: socratic(
      'Mathematics',
      'Data Handling and Probability',
      'Can you calculate the mean, median and mode? We\'ll review measures of central tendency, then explore probability with coin-flip and dice examples.',
    ),
  },
  {
    id: 'snr-creative-arts',
    label: 'Literature & Poetry',
    subject: 'English Home Language',
    icon: 'color-palette-outline',
    phase: 'senior',
    prompt: socratic(
      'English',
      'Literature and Poetry',
      'I\'ll share a poem or extract and ask you to identify figurative language, themes, and the writer\'s purpose. Then we\'ll analyse together.',
    ),
  },
];

const FET_TOPICS: TopicSuggestion[] = [
  {
    id: 'fet-calculus',
    label: 'Calculus (Differentiation)',
    subject: 'Mathematics',
    icon: 'trending-up-outline',
    phase: 'fet',
    prompt: socratic(
      'Mathematics',
      'Calculus — Differentiation',
      'Do you understand limits and average rate of change? We\'ll start there, then derive functions from first principles and apply rules to find gradients and turning points.',
    ),
  },
  {
    id: 'fet-trigonometry',
    label: 'Trigonometry',
    subject: 'Mathematics',
    icon: 'analytics-outline',
    phase: 'fet',
    prompt: socratic(
      'Mathematics',
      'Trigonometry',
      'Let\'s check your knowledge of sin, cos, and tan ratios. Then we\'ll work through identities, equations, and graphs of trig functions.',
    ),
  },
  {
    id: 'fet-organic-chem',
    label: 'Organic Chemistry',
    subject: 'Physical Sciences',
    icon: 'flask-outline',
    phase: 'fet',
    prompt: socratic(
      'Physical Sciences',
      'Organic Chemistry',
      'Can you name the first five alkanes? We\'ll start with naming and structural formulae, then explore functional groups, isomers, and reaction types.',
    ),
  },
  {
    id: 'fet-genetics',
    label: 'Genetics & Inheritance',
    subject: 'Life Sciences',
    icon: 'git-branch-outline',
    phase: 'fet',
    prompt: socratic(
      'Life Sciences',
      'Genetics',
      'Let\'s start with DNA structure and replication. I\'ll check your understanding of meiosis, then we\'ll do Punnett squares and discuss genetic disorders.',
    ),
  },
  {
    id: 'fet-accounting',
    label: 'Accounting',
    subject: 'Accounting',
    icon: 'receipt-outline',
    phase: 'fet',
    prompt: socratic(
      'Accounting',
      'Financial Statements',
      'Do you know the difference between an income statement and a balance sheet? We\'ll build both from a trial balance and analyse the results.',
    ),
  },
  {
    id: 'fet-business-studies',
    label: 'Business Studies',
    subject: 'Business Studies',
    icon: 'briefcase-outline',
    phase: 'fet',
    prompt: socratic(
      'Business Studies',
      'Business Environments',
      'Let me check your understanding of micro, market, and macro environments. Then we\'ll look at business strategies, ethics, and legislation.',
    ),
  },
  {
    id: 'fet-functions',
    label: 'Functions & Graphs',
    subject: 'Mathematics',
    icon: 'pulse-outline',
    phase: 'fet',
    prompt: socratic(
      'Mathematics',
      'Functions and Graphs',
      'Can you sketch a parabola from its equation? We\'ll cover linear, quadratic, hyperbolic, and exponential functions — domain, range, intercepts and asymptotes.',
    ),
  },
  {
    id: 'fet-electricity',
    label: 'Electricity & Magnetism',
    subject: 'Physical Sciences',
    icon: 'flash-outline',
    phase: 'fet',
    prompt: socratic(
      'Physical Sciences',
      'Electricity and Magnetism',
      'What do you know about Ohm\'s law? We\'ll start with series and parallel circuits, calculate resistance, current and voltage, then explore electromagnetic induction.',
    ),
  },
  {
    id: 'fet-probability',
    label: 'Probability & Counting',
    subject: 'Mathematics',
    icon: 'dice-outline',
    phase: 'fet',
    prompt: socratic(
      'Mathematics',
      'Probability and Counting Principles',
      'Can you use the fundamental counting principle? We\'ll work through permutations, combinations, Venn diagrams, tree diagrams, and dependent vs independent events.',
    ),
  },
  {
    id: 'fet-history-sa',
    label: 'SA History (Apartheid & Democracy)',
    subject: 'History',
    icon: 'flag-outline',
    phase: 'fet',
    prompt: socratic(
      'History',
      'South African History',
      'What do you know about the causes and effects of apartheid? We\'ll analyse sources, evaluate perspectives, and trace the path to democracy.',
    ),
  },
];

// ─── All topics indexed by phase ─────────────────────────────────────────────

const TOPICS_BY_PHASE: Record<CAPSPhase, TopicSuggestion[]> = {
  foundation: FOUNDATION_TOPICS,
  intermediate: INTERMEDIATE_TOPICS,
  senior: SENIOR_TOPICS,
  fet: FET_TOPICS,
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns topic suggestions appropriate for the given grade.  An optional
 * `term` parameter (1–4) is reserved for future per-term filtering; currently
 * all topics for the phase are returned.
 */
export function getTopicSuggestionsForGrade(
  grade: string,
  _term?: number,
): TopicSuggestion[] {
  const phase = gradeToPhase(grade);
  return TOPICS_BY_PHASE[phase] ?? FOUNDATION_TOPICS;
}
