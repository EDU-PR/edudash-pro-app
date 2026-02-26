/**
 * Static question bank – fallback when AI generation is unavailable.
 *
 * Organised by CAPS phase (Foundation, Intermediate, Senior, FET)
 * with ~10 questions per subject per phase band.
 */

import type { ExerciseQuestion, SubjectCode } from './types';

// ─── helpers ────────────────────────────────────────────────────────────────

let _seqId = 0;
function qid(): string {
  _seqId += 1;
  return `bank-${_seqId}`;
}

function mc(
  subjectCode: SubjectCode,
  question: string,
  options: string[],
  correct: string,
  explanation: string,
  hasLatex = false,
): ExerciseQuestion {
  return { id: qid(), subjectCode, questionText: question, questionType: 'multiple_choice', options, correctAnswer: correct, explanation, hasLatex };
}

function fb(
  subjectCode: SubjectCode,
  question: string,
  correct: string,
  explanation: string,
): ExerciseQuestion {
  return { id: qid(), subjectCode, questionText: question, questionType: 'fill_blank', correctAnswer: correct, explanation };
}

function tf(
  subjectCode: SubjectCode,
  question: string,
  correct: 'true' | 'false',
  explanation: string,
): ExerciseQuestion {
  return { id: qid(), subjectCode, questionText: question, questionType: 'true_false', options: ['True', 'False'], correctAnswer: correct === 'true' ? 'True' : 'False', explanation };
}

// ─── Mathematics – Foundation (Grades R-3) ──────────────────────────────────

const MATHS_FOUNDATION: ExerciseQuestion[] = [
  mc('mathematics', 'What number comes after 9?', ['8', '10', '11', '7'], '10', 'Counting: after 9 comes 10.'),
  mc('mathematics', '3 + 4 = ?', ['5', '6', '7', '8'], '7', '3 plus 4 equals 7.'),
  mc('mathematics', '8 - 3 = ?', ['4', '5', '6', '3'], '5', '8 take away 3 equals 5.'),
  fb('mathematics', 'Complete the pattern: 2, 4, 6, ___', '8', 'Counting in twos: 2, 4, 6, 8.'),
  mc('mathematics', 'How many sides does a triangle have?', ['2', '3', '4', '5'], '3', 'A triangle has 3 sides.'),
  tf('mathematics', '15 is greater than 12.', 'true', '15 is bigger than 12.'),
  mc('mathematics', 'Which is heavier: a feather or a brick?', ['Feather', 'Brick', 'They weigh the same', 'Neither'], 'Brick', 'A brick is much heavier than a feather.'),
  fb('mathematics', '5 + ___ = 9', '4', '5 plus 4 equals 9.'),
  mc('mathematics', 'How many days are in a week?', ['5', '6', '7', '8'], '7', 'There are 7 days in a week.'),
  mc('mathematics', 'Which coin is worth more: R1 or R2?', ['R1', 'R2', 'They are equal', 'Neither'], 'R2', 'R2 is worth more than R1.'),
];

// ─── Mathematics – Intermediate (Grades 4-6) ───────────────────────────────

const MATHS_INTERMEDIATE: ExerciseQuestion[] = [
  mc('mathematics', 'What is $\\frac{1}{2} + \\frac{1}{4}$?', ['$\\frac{1}{4}$', '$\\frac{2}{4}$', '$\\frac{3}{4}$', '$\\frac{1}{6}$'], '$\\frac{3}{4}$', '$\\frac{1}{2} = \\frac{2}{4}$, so $\\frac{2}{4} + \\frac{1}{4} = \\frac{3}{4}$.', true),
  mc('mathematics', '7 × 8 = ?', ['54', '56', '58', '64'], '56', '7 times 8 equals 56.'),
  fb('mathematics', '48 ÷ 6 = ___', '8', '48 divided by 6 equals 8.'),
  mc('mathematics', 'Which is bigger: 0.5 or 0.45?', ['0.5', '0.45', 'They are equal', 'Cannot tell'], '0.5', '0.50 is larger than 0.45.'),
  mc('mathematics', 'How many degrees in a right angle?', ['45°', '90°', '180°', '360°'], '90°', 'A right angle measures 90 degrees.'),
  tf('mathematics', 'In 3 456, the digit 4 is in the hundreds place.', 'true', '3 456 = 3 thousands + 4 hundreds + 5 tens + 6 units.'),
  mc('mathematics', 'Sam has 24 sweets and shares them equally among 4 friends. How many does each get?', ['4', '5', '6', '8'], '6', '24 ÷ 4 = 6 sweets each.'),
  fb('mathematics', '50% of 80 = ___', '40', 'Half of 80 is 40.'),
  mc('mathematics', 'What is the perimeter of a rectangle with length 5 cm and width 3 cm?', ['8 cm', '15 cm', '16 cm', '30 cm'], '16 cm', 'Perimeter = 2 × (5 + 3) = 16 cm.'),
  mc('mathematics', 'What type of graph uses bars to show data?', ['Pie chart', 'Bar graph', 'Line graph', 'Pictograph'], 'Bar graph', 'A bar graph uses bars of different heights to represent data.'),
];

// ─── Mathematics – Senior (Grades 7-9) ─────────────────────────────────────

const MATHS_SENIOR: ExerciseQuestion[] = [
  mc('mathematics', 'Solve: 2x + 5 = 13', ['x = 3', 'x = 4', 'x = 5', 'x = 9'], 'x = 4', '2x = 8 so x = 4.'),
  mc('mathematics', 'What is -3 + 7?', ['-10', '-4', '4', '10'], '4', '-3 + 7 = 4.'),
  fb('mathematics', '$2^5 = $ ___', '32', '$2^5 = 2 \\times 2 \\times 2 \\times 2 \\times 2 = 32$.'),
  mc('mathematics', 'Simplify the ratio 12 : 8.', ['6 : 4', '3 : 2', '4 : 3', '2 : 1'], '3 : 2', 'Divide both by 4: 12÷4=3, 8÷4=2.'),
  mc('mathematics', 'The angles of a triangle add up to…', ['90°', '180°', '270°', '360°'], '180°', 'The interior angles of any triangle sum to 180°.'),
  mc('mathematics', 'In a right triangle with legs 3 and 4, the hypotenuse is…', ['5', '6', '7', '12'], '5', '$3^2 + 4^2 = 25$, $\\sqrt{25} = 5$.', true),
  tf('mathematics', 'The probability of an event is always between 0 and 1 inclusive.', 'true', 'By definition probability ranges from 0 to 1.'),
  fb('mathematics', 'If y = 3x + 1 and x = 2, then y = ___', '7', 'y = 3(2) + 1 = 7.'),
  mc('mathematics', 'Area of a circle with radius 7 cm (use π ≈ 22/7):', ['44 cm²', '154 cm²', '88 cm²', '308 cm²'], '154 cm²', 'A = πr² = (22/7) × 49 = 154 cm².'),
  mc('mathematics', 'The median of 3, 7, 9, 12, 15 is…', ['7', '9', '12', '15'], '9', 'Sorted middle value = 9.'),
];

// ─── Mathematics – FET (Grades 10-12) ───────────────────────────────────────

const MATHS_FET: ExerciseQuestion[] = [
  mc('mathematics', 'If f(x) = x² − 4, what is f(3)?', ['5', '9', '13', '-1'], '5', 'f(3) = 9 − 4 = 5.'),
  mc('mathematics', 'sin 30° = ?', ['$\\frac{1}{2}$', '$\\frac{\\sqrt{3}}{2}$', '$\\frac{\\sqrt{2}}{2}$', '1'], '$\\frac{1}{2}$', 'sin 30° = 0.5.', true),
  fb('mathematics', '$\\log_{10} 1000 = $ ___', '3', '$10^3 = 1000$.'),
  mc('mathematics', 'Next term in 2, 6, 18, 54, …?', ['72', '108', '162', '216'], '162', 'Geometric sequence × 3: 54 × 3 = 162.'),
  mc('mathematics', 'The derivative of x³ is…', ['x²', '2x²', '3x²', '3x³'], '3x²', 'Using the power rule: d/dx(x³) = 3x².'),
  tf('mathematics', '$P(A \\cup B) = P(A) + P(B)$ always holds.', 'false', 'Only if A and B are mutually exclusive; otherwise subtract P(A ∩ B).'),
  mc('mathematics', 'Solutions of x² − 5x + 6 = 0 are…', ['x = 1 and x = 6', 'x = 2 and x = 3', 'x = -2 and x = -3', 'x = 0 and x = 5'], 'x = 2 and x = 3', 'Factors: (x−2)(x−3) = 0.'),
  fb('mathematics', 'R1 000 at 10% p.a. compounded annually for 2 years = R___', '1210', 'A = 1000(1.1)² = 1210.'),
  mc('mathematics', 'Volume of a sphere: $V = \\frac{4}{3}\\pi r^3$. If r = 3, V ≈ ?', ['36π', '108π', '27π', '12π'], '36π', 'V = (4/3)π(27) = 36π.', true),
  mc('mathematics', 'Standard deviation measures…', ['Central tendency', 'Spread of data', 'Most common value', 'Range only'], 'Spread of data', 'Standard deviation quantifies how spread out data values are.'),
];

// ─── English HL ─────────────────────────────────────────────────────────────

const ENGLISH_FOUNDATION: ExerciseQuestion[] = [
  mc('english_hl', 'Choose the correct word: The cat ___ on the mat.', ['sit', 'sits', 'sitted', 'sat'], 'sits', 'Present tense third person singular: sits.'),
  fb('english_hl', 'The opposite of "big" is ___', 'small', '"Big" and "small" are antonyms.'),
  tf('english_hl', 'A sentence always starts with a capital letter.', 'true', 'Sentences begin with an uppercase letter.'),
  mc('english_hl', 'In the sentence "The dog ran fast", what did the dog do?', ['Slept', 'Ran', 'Ate', 'Sat'], 'Ran', 'The verb "ran" tells us the action.'),
  fb('english_hl', 'Complete: b _ _ k (a thing you read)', 'oo', 'The word is "book".'),
  mc('english_hl', 'Which is a noun?', ['Run', 'Happy', 'Table', 'Quickly'], 'Table', 'A noun is a person, place, or thing. "Table" is a thing.'),
  tf('english_hl', '"Once upon a time" usually starts a fairy tale.', 'true', 'This is a classic fairy tale opening.'),
  mc('english_hl', 'A word that means the same as "happy" is…', ['Sad', 'Angry', 'Glad', 'Tired'], 'Glad', '"Glad" is a synonym for "happy".'),
  fb('english_hl', 'She ___ (go) to school every day.', 'goes', 'Third person singular present: goes.'),
  mc('english_hl', '"It was raining, so Thandi took her umbrella." Why did Thandi take her umbrella?', ['It was sunny', 'It was raining', 'She forgot it', 'Her mom said so'], 'It was raining', 'The sentence tells us it was raining.'),
];

const ENGLISH_INTERMEDIATE: ExerciseQuestion[] = [
  mc('english_hl', 'Select the correct past tense: She ___ to the store yesterday.', ['go', 'goes', 'went', 'going'], 'went', '"Went" is the past tense of "go".'),
  mc('english_hl', 'What does "abundant" mean?', ['Scarce', 'Plentiful', 'Tiny', 'Broken'], 'Plentiful', '"Abundant" means having a large quantity.'),
  fb('english_hl', 'The plural of "child" is ___', 'children', '"Children" is the irregular plural of "child".'),
  mc('english_hl', 'Which sentence uses a comma correctly?', ['After lunch, we played outside.', 'After, lunch we played outside.', 'After lunch we, played outside.', 'After lunch we played, outside.'], 'After lunch, we played outside.', 'A comma follows an introductory phrase.'),
  tf('english_hl', 'An adverb describes a noun.', 'false', 'An adverb describes a verb, adjective, or another adverb. Adjectives describe nouns.'),
  mc('english_hl', '"The library was quiet except for the sound of turning pages." The mood is…', ['Exciting', 'Peaceful', 'Scary', 'Sad'], 'Peaceful', 'Quietness and turning pages suggest a calm, peaceful atmosphere.'),
  fb('english_hl', 'A person who writes books is called an ___', 'author', 'An author is someone who writes books.'),
  mc('english_hl', 'Which sentence is correct?', ['Me and him went.', 'Him and I went.', 'He and I went.', 'Me and he went.'], 'He and I went.', 'Subject pronouns: He and I.'),
  mc('english_hl', '"Time flies when you\'re having fun" is an example of…', ['Simile', 'Metaphor', 'Alliteration', 'Personification'], 'Metaphor', 'Time does not literally fly; it is a metaphor.'),
  fb('english_hl', 'The correct spelling: nec___ary', 'ess', 'The word is "necessary".'),
];

const ENGLISH_SENIOR: ExerciseQuestion[] = [
  mc('english_hl', 'Identify the passive voice sentence.', ['The cat chased the mouse.', 'The mouse was chased by the cat.', 'The cat is chasing the mouse.', 'The mouse ran away.'], 'The mouse was chased by the cat.', 'Passive: subject receives the action (was chased).'),
  mc('english_hl', '"Ubiquitous" means…', ['Rare', 'Found everywhere', 'Invisible', 'Ancient'], 'Found everywhere', '"Ubiquitous" describes something present everywhere.'),
  fb('english_hl', 'A 14-line poem with a specific rhyme scheme is called a ___', 'sonnet', 'A sonnet has 14 lines, typically in iambic pentameter.'),
  mc('english_hl', 'An unreliable narrator is one who…', ['Tells the truth', 'Cannot be fully trusted', 'Writes non-fiction', 'Uses third person'], 'Cannot be fully trusted', 'An unreliable narrator\'s account may be biased or inaccurate.'),
  tf('english_hl', '"Who" is used for subjects and "whom" for objects.', 'true', '"Who" = subject pronoun, "whom" = object pronoun.'),
  mc('english_hl', '"The world is a stage" is…', ['Simile', 'Metaphor', 'Hyperbole', 'Onomatopoeia'], 'Metaphor', 'A direct comparison without "like" or "as".'),
  fb('english_hl', 'The opposite of "benevolent" is ___', 'malevolent', '"Benevolent" = kind; "malevolent" = hostile.'),
  mc('english_hl', 'A thesis statement should…', ['Ask a question', 'State your argument', 'List all topics', 'Be very long'], 'State your argument', 'A thesis clearly states the main argument of an essay.'),
  mc('english_hl', '"Although" is a…', ['Noun', 'Verb', 'Conjunction', 'Adverb'], 'Conjunction', '"Although" is a subordinating conjunction.'),
  fb('english_hl', 'Correct: accomm___ation', 'od', 'The word is "accommodation" — double c, double m.'),
];

// ─── Afrikaans HL ───────────────────────────────────────────────────────────

const AFRIKAANS_BANK: ExerciseQuestion[] = [
  mc('afrikaans_hl', 'Wat is die Afrikaans vir "dog"?', ['Kat', 'Hond', 'Vis', 'Voël'], 'Hond', '"Dog" in Afrikaans is "hond".'),
  fb('afrikaans_hl', 'Die meervoud van "kind" is ___', 'kinders', '"Kind" → "kinders" (plural).'),
  mc('afrikaans_hl', '"Die son skyn helder." Wat beteken "helder"?', ['Donker', 'Lig', 'Koud', 'Nat'], 'Lig', '"Helder" beteken bright/lig.'),
  tf('afrikaans_hl', '"Ek is" is teenwoordige tyd.', 'true', '"Ek is" is present tense.'),
  mc('afrikaans_hl', 'Die teenoorgestelde van "groot" is…', ['Klein', 'Lank', 'Breed', 'Swaar'], 'Klein', '"Groot" (big) se teenoorgestelde is "klein" (small).'),
  fb('afrikaans_hl', 'Hy ___ (loop) elke dag skool toe.', 'loop', 'Teenwoordige tyd: Hy loop.'),
  mc('afrikaans_hl', 'Watter woord is korrek gespel?', ['Byvoorbeeld', 'Bivoorbeeld', 'Byvoorbeelt', 'Bievoorbeeld'], 'Byvoorbeeld', '"Byvoorbeeld" is korrek gespel.'),
  mc('afrikaans_hl', '"Sy is baie slim." "Slim" beteken…', ['Stupid', 'Clever', 'Lazy', 'Tired'], 'Clever', '"Slim" = clever/smart.'),
  tf('afrikaans_hl', '"Het geloop" is verlede tyd.', 'true', '"Het geloop" is past tense (walked).'),
  fb('afrikaans_hl', 'Die Afrikaans vir "water" is ___', 'water', '"Water" is dieselfde in Afrikaans.'),
];

// ─── isiZulu HL ─────────────────────────────────────────────────────────────

const ISIZULU_BANK: ExerciseQuestion[] = [
  mc('isizulu_hl', 'What is the isiZulu word for "mother"?', ['Ubaba', 'Umama', 'Udadewethu', 'Umfowethu'], 'Umama', '"Umama" means mother.'),
  fb('isizulu_hl', 'The plural prefix for "umuntu" (person) is ___', 'aba', '"Umuntu" → "abantu" (people), prefix aba-.'),
  mc('isizulu_hl', '"Ngiyabonga" means…', ['Hello', 'Goodbye', 'Thank you', 'Please'], 'Thank you', '"Ngiyabonga" = I thank you / Thank you.'),
  tf('isizulu_hl', '"Sawubona" is a greeting in isiZulu.', 'true', '"Sawubona" means "hello" / "I see you".'),
  mc('isizulu_hl', 'What does "amanzi" mean?', ['Fire', 'Water', 'Earth', 'Wind'], 'Water', '"Amanzi" = water.'),
  fb('isizulu_hl', 'Ngi___ ukudla. (I eat food)', 'ya', '"Ngiya" — present tense marker + verb stem.'),
  mc('isizulu_hl', '"Izulu liyana." What is happening?', ['Sun is shining', 'It is raining', 'Wind is blowing', 'It is snowing'], 'It is raining', '"Izulu liyana" = It is raining.'),
  mc('isizulu_hl', '"Isikole" means…', ['Church', 'Hospital', 'School', 'Home'], 'School', '"Isikole" = school.'),
  tf('isizulu_hl', 'isiZulu nouns are grouped into noun classes.', 'true', 'isiZulu uses a noun class system with prefixes.'),
  fb('isizulu_hl', 'The isiZulu word for "book" is ___', 'incwadi', '"Incwadi" = book.'),
];

// ─── Phase lookup ───────────────────────────────────────────────────────────

type PhaseBand = 'foundation' | 'intermediate' | 'senior' | 'fet';

function gradeToPhaseBand(grade: string): PhaseBand {
  const num = parseInt(grade.replace(/\D/g, ''), 10);
  if (Number.isNaN(num) || num <= 3) return 'foundation';
  if (num <= 6) return 'intermediate';
  if (num <= 9) return 'senior';
  return 'fet';
}

const MATHS_BANKS: Record<PhaseBand, ExerciseQuestion[]> = {
  foundation: MATHS_FOUNDATION,
  intermediate: MATHS_INTERMEDIATE,
  senior: MATHS_SENIOR,
  fet: MATHS_FET,
};

const ENGLISH_BANKS: Record<PhaseBand, ExerciseQuestion[]> = {
  foundation: ENGLISH_FOUNDATION,
  intermediate: ENGLISH_INTERMEDIATE,
  senior: ENGLISH_SENIOR,
  fet: ENGLISH_SENIOR,
};

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Retrieve fallback questions from the static bank.
 */
export function getFallbackQuestions(
  subject: SubjectCode,
  grade: string,
  count: number,
): ExerciseQuestion[] {
  const phase = gradeToPhaseBand(grade);

  let pool: ExerciseQuestion[];

  switch (subject) {
    case 'mathematics':
      pool = MATHS_BANKS[phase];
      break;
    case 'english_hl':
      pool = ENGLISH_BANKS[phase];
      break;
    case 'afrikaans_hl':
    case 'afrikaans_fal':
      pool = AFRIKAANS_BANK;
      break;
    case 'isizulu_hl':
    case 'isizulu_fal':
      pool = ISIZULU_BANK;
      break;
    default:
      pool = ENGLISH_BANKS[phase];
  }

  return pickRandom(pool, Math.min(count, pool.length));
}
