/**
 * Exam Prep Tool — CAPS-Hardened Edition
 *
 * Generates fully CAPS-aligned exam materials for South African Grades R-12.
 *
 * Enhancements over v1:
 *  - Strict CAPS phase/subject/curriculum mapping
 *  - SA exam format (Section A / B / C with correct marks distribution)
 *  - Extended explanations: concept linkage, common mistakes, worked steps
 *  - Extended practice: graduated difficulty with 5 worked examples + 10+ questions
 *  - concept_deep_dive: single concept with vocabulary, examples, CAPS alignment
 *  - comprehensive_exam: full 20-30 question paper in official SA format
 *  - Memorandum/answer key with marking guidelines
 *  - All 11 official SA languages
 */

import {
  Tool,
  ToolCategory,
  RiskLevel,
  ToolParameter,
  ToolExecutionContext,
  ToolExecutionResult,
} from '../types';
import { hasCapability, resolveCapabilityTier } from '@/lib/ai/capabilities';
import type { Tier } from '@/lib/ai/capabilities';

// ─── Types ────────────────────────────────────────────────────────────────────

const EXAM_TYPES = [
  'practice_test',
  'comprehensive_exam',
  'extended_practice',
  'concept_deep_dive',
  'revision_notes',
  'flashcards',
  'study_guide',
  'past_paper',
  'quiz',
  'worksheet',
] as const;

type ExamType = (typeof EXAM_TYPES)[number];

const SUPPORTED_LANGUAGES = [
  'en-ZA', 'af-ZA', 'zu-ZA', 'xh-ZA', 'st-ZA',
  'tn-ZA', 'ss-ZA', 've-ZA', 'ts-ZA', 'nr-ZA', 'nso-ZA',
] as const;

const LANG_NAMES: Record<string, string> = {
  'en-ZA': 'English',
  'af-ZA': 'Afrikaans',
  'zu-ZA': 'isiZulu',
  'xh-ZA': 'isiXhosa',
  'st-ZA': 'Sesotho',
  'tn-ZA': 'Setswana',
  'ss-ZA': 'siSwati',
  've-ZA': 'Tshivenda',
  'ts-ZA': 'Xitsonga',
  'nr-ZA': 'isiNdebele',
  'nso-ZA': 'Sepedi',
};

// ─── CAPS Phase Detection ─────────────────────────────────────────────────────

function getCAPSPhase(grade: string): {
  label: string;
  code: 'foundation' | 'intermediate' | 'senior' | 'fet';
  gradeNum: number;
} {
  const g = grade.trim().toLowerCase();
  if (g === 'r' || g === '0') return { label: 'Foundation Phase (Grade R)', code: 'foundation', gradeNum: 0 };
  const n = parseInt(g, 10);
  if (n <= 3) return { label: `Foundation Phase (Grade ${n})`, code: 'foundation', gradeNum: n };
  if (n <= 6) return { label: `Intermediate Phase (Grade ${n})`, code: 'intermediate', gradeNum: n };
  if (n <= 9) return { label: `Senior Phase (Grade ${n})`, code: 'senior', gradeNum: n };
  return { label: `FET Phase (Grade ${n})`, code: 'fet', gradeNum: n };
}

// ─── CAPS Curriculum Map ──────────────────────────────────────────────────────

const CAPS_CURRICULUM: Record<string, Record<string, string[]>> = {
  foundation: {
    Mathematics: [
      'Numbers, Operations & Relationships (counting, number sense, addition, subtraction)',
      'Patterns, Functions & Algebra (repeating patterns, number patterns)',
      'Space & Shape (2D shapes, 3D objects, position)',
      'Measurement (time, length, mass, capacity)',
      'Data Handling (sorting, tables, pictographs)',
    ],
    'Home Language': [
      'Listening & Speaking (oral vocabulary, instructions, stories)',
      'Phonics & Word Recognition (letter sounds, blending, sight words)',
      'Reading & Phonics (shared reading, decoding, fluency)',
      'Writing (letter formation, words, simple sentences)',
      'Language Structures (nouns, verbs, adjectives)',
    ],
    'Life Skills': [
      'Beginning Knowledge (personal health, safety, community)',
      'Creative Arts (visual arts, music, drama, dance)',
      'Physical Education (body awareness, movement, games)',
    ],
  },
  intermediate: {
    Mathematics: [
      'Numbers, Operations & Relationships (whole numbers, fractions, decimals)',
      'Patterns, Functions & Algebra (numeric patterns, rules, expressions)',
      'Space & Shape (2D shapes, 3D objects, symmetry, transformations)',
      'Measurement (perimeter, area, volume, time, temperature)',
      'Data Handling (bar graphs, pie charts, mode, median, mean)',
    ],
    'Natural Sciences & Technology': [
      'Life & Living (ecosystems, food chains, adaptations, human body)',
      'Energy & Change (forces, magnetism, electricity, sound, light)',
      'Earth & Beyond (weather, seasons, planets, rocks & minerals)',
      'Structures (materials, properties, building)',
      'Processing (separating mixtures, chemical change)',
    ],
    'Social Sciences': [
      'History (ancient civilisations, SA heritage, colonialism)',
      'Geography (maps, weather, SA regions, global communities)',
    ],
  },
  senior: {
    Mathematics: [
      'Numbers (integers, fractions, decimals, exponents, scientific notation)',
      'Functions & Relationships (linear, parabola, hyperbola)',
      'Algebra (expressions, equations, inequalities)',
      'Graphs (interpret, draw, analyse)',
      'Geometry (triangles, quadrilaterals, Pythagoras, similarity)',
      'Transformation Geometry (translation, reflection, rotation)',
      'Data Handling (statistical measures, probability)',
      'Financial Mathematics (simple/compound interest, hire purchase)',
    ],
    'Natural Sciences': [
      'Matter & Materials (atoms, elements, compounds, chemical equations)',
      'Energy & Change (electricity, circuits, electromagnetism, waves)',
      'Earth & Beyond (solar system, astronomy, lithosphere)',
      'Life & Living (cells, genetics, evolution, ecology)',
    ],
    'Social Sciences': [
      'History (World War I & II, apartheid, SA democracy, human rights)',
      'Geography (climate, vegetation biomes, rivers, population, urbanisation)',
    ],
    'Economic & Management Sciences': [
      'The Economy (sectors, economic systems, entrepreneurship)',
      'Business Roles (SMME, business environments)',
      'Financial Literacy (budgets, income statements, cash flow)',
    ],
    'Mathematical Literacy': [
      'Numbers & Calculations in Context',
      'Patterns, Relationships & Representations',
      'Measurement (perimeter, area, volume, time)',
      'Finance (taxation, banking, insurance)',
      'Data Handling (statistics, probability)',
    ],
  },
  fet: {
    Mathematics: [
      'Algebra (algebraic manipulation, surds, logarithms)',
      'Number Patterns (arithmetic, geometric sequences)',
      'Functions (hyperbola, exponential, logarithm, trig)',
      'Finance, Growth & Decay (compound interest, annuities)',
      'Trigonometry (identities, equations, 2D/3D problems)',
      'Euclidean Geometry (circles, triangles, proofs)',
      'Analytical Geometry (distance, midpoint, gradient, equations)',
      'Statistics (regression, correlation, normal distribution)',
      'Probability (Venn diagrams, tree diagrams, counting)',
      'Calculus (limits, derivatives, integration)',
    ],
    'Mathematical Literacy': [
      'Finance (interest, tax, deductions, exchange rates)',
      'Measurement (SI units, conversions, surface area, volume)',
      'Maps & Plans (scale, models, networks)',
      'Data Handling (statistics, probability, data representation)',
    ],
    'Physical Sciences': [
      'Mechanics (kinematics, dynamics, Newton\'s laws, momentum, energy)',
      'Waves & Electricity (electrostatics, circuits, photoelectric effect)',
      'Matter & Materials (electrochemistry, acids & bases, organic chemistry)',
    ],
    'Life Sciences': [
      'Biochemistry (enzymes, photosynthesis, cellular respiration)',
      'Genetics (DNA, Mendel, mutations, evolution)',
      'Ecology (biomes, energy flow, biodiversity)',
      'Human Systems (nervous, immune, reproduction)',
    ],
    'Accounting': [
      'Financial Accounting (journals, ledger, trial balance, financial statements)',
      'Cost Accounting (manufacturing accounts, ethics)',
      'Auditing & Internal Control',
    ],
    English: [
      'Comprehension (literal, inferential, critical reading)',
      'Language Structures & Conventions (grammar, vocabulary, spelling)',
      'Writing (transactional, creative, argumentative, analytical)',
      'Literature (poetry, drama, novel analysis)',
    ],
  },
};

// ─── SA Exam Format Builder ───────────────────────────────────────────────────

function buildSAExamFormatInstruction(
  examType: ExamType,
  numQuestions: number,
  grade: string,
  totalMarks: number,
): string {
  const phase = getCAPSPhase(grade);

  if (examType === 'comprehensive_exam') {
    const sectionACount = Math.min(20, Math.round(numQuestions * 0.5));
    const sectionBCount = Math.min(8, Math.round(numQuestions * 0.3));
    const sectionCCount = numQuestions - sectionACount - sectionBCount;
    const sectionAMarks = sectionACount;
    const sectionBMarks = sectionBCount * 4;
    const sectionCMarks = totalMarks - sectionAMarks - sectionBMarks;

    return `Generate a COMPREHENSIVE SA CAPS EXAM in the following STRICT JSON format:

{
  "title": "Grade ${grade} [Subject] — [Term] Assessment",
  "grade": "${grade}",
  "subject": "[subject]",
  "caps_phase": "${phase.label}",
  "caps_topics": ["list", "of", "CAPS", "topics", "covered"],
  "duration": "1 hour 30 minutes",
  "total_marks": ${totalMarks},
  "instructions": [
    "Read all questions carefully before answering.",
    "Write neatly and legibly.",
    "Show ALL working in Section B and C.",
    "Calculators are ${phase.gradeNum >= 7 ? 'permitted' : 'NOT permitted'} unless stated.",
    "Answer ALL questions."
  ],
  "sections": [
    {
      "id": "section_a",
      "title": "SECTION A: MULTIPLE CHOICE",
      "instructions": "Choose ONE correct answer. Circle the letter of your answer. (${sectionACount} × 1 mark = ${sectionAMarks} marks)",
      "marks_per_question": 1,
      "questions": [/* ${sectionACount} multiple-choice questions */]
    },
    {
      "id": "section_b",
      "title": "SECTION B: SHORT ANSWER",
      "instructions": "Answer ALL questions. Show your working. (${sectionBCount} questions = ${sectionBMarks} marks)",
      "questions": [/* ${sectionBCount} short-answer questions, 4 marks each */]
    },
    {
      "id": "section_c",
      "title": "SECTION C: EXTENDED RESPONSE",
      "instructions": "Answer ALL questions. Write in full sentences where required. (${sectionCCount} questions = ${sectionCMarks} marks)",
      "questions": [/* ${sectionCCount} extended questions */]
    }
  ],
  "memorandum": {
    "section_a": [{"q": 1, "answer": "A", "concept": "CAPS concept reference"}],
    "section_b": [{"q": 1, "answer": "full answer with marks allocation", "marking_guideline": "1 mark for X, 1 mark for Y..."}],
    "section_c": [{"q": 1, "answer": "model answer", "marking_guideline": "detailed rubric"}]
  }
}

Each question object must include:
{
  "id": "q1",
  "type": "multiple_choice"|"short_answer"|"essay"|"numeric",
  "text": "Question text",
  "marks": 1,
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],  // Section A only
  "correct_answer": "B",
  "caps_topic": "Exact CAPS curriculum topic",
  "cognitive_level": "knowledge"|"routine_procedure"|"complex_procedure"|"problem_solving",
  "explanation": "Full concept explanation including: (1) what the concept IS, (2) why this answer is correct, (3) common mistakes students make, (4) how to remember it. MINIMUM 80 words.",
  "extended_explanation": "Deeper explanation for struggling students: rephrase in simpler language, use an analogy, give a real-life SA example. MINIMUM 100 words."
}`;
  }

  if (examType === 'extended_practice') {
    return `Generate EXTENDED PRACTICE WORK in the following STRICT JSON format:

{
  "title": "Grade ${grade} [Subject] — Extended Practice: [Topic]",
  "grade": "${grade}",
  "subject": "[subject]",
  "topic": "[topic]",
  "caps_phase": "${phase.label}",
  "caps_topic_reference": "Exact CAPS curriculum topic and learning outcome",
  "worked_examples": [
    {
      "id": "we1",
      "difficulty": "easy",
      "problem": "Problem statement",
      "solution_steps": [
        {"step": 1, "instruction": "First do...", "working": "...", "explanation": "We do this because..."},
        {"step": 2, "instruction": "Then...", "working": "...", "explanation": "..."}
      ],
      "final_answer": "The answer is X",
      "caps_concept": "Which CAPS concept this tests"
    }
    /* 5 worked examples: 2 easy, 2 medium, 1 hard */
  ],
  "practice_questions": [
    {
      "id": "p1",
      "difficulty": "easy"|"medium"|"hard",
      "type": "multiple_choice"|"short_answer"|"numeric",
      "text": "Question",
      "marks": 2,
      "options": [...],  // if multiple_choice
      "correct_answer": "...",
      "hint": "If stuck, try...",
      "caps_concept": "CAPS topic",
      "explanation": "Full step-by-step solution with every line of working shown. MINIMUM 80 words.",
      "common_mistake": "Most students get this wrong by..."
    }
    /* 12 questions: 4 easy, 5 medium, 3 hard */
  ],
  "vocabulary_glossary": [
    {"term": "...", "definition": "...", "example": "..."}
  ],
  "study_tips": ["...", "..."]
}`;
  }

  if (examType === 'concept_deep_dive') {
    return `Generate a CONCEPT DEEP DIVE in the following STRICT JSON format:

{
  "title": "Deep Dive: [Concept] — Grade ${grade} [Subject]",
  "grade": "${grade}",
  "subject": "[subject]",
  "concept": "[topic]",
  "caps_phase": "${phase.label}",
  "caps_learning_outcome": "The exact CAPS learning outcome this concept addresses",
  "concept_explanation": {
    "simple_definition": "One sentence a Grade ${grade} learner can understand",
    "detailed_explanation": "3-4 paragraph explanation. Start simple. Build complexity. Use SA context (Joburg, Cape Town, SA wildlife, SA money — Rands, SA sport). MINIMUM 200 words.",
    "visual_description": "Describe a diagram that would help understand this concept",
    "real_life_examples": ["SA-context example 1", "SA-context example 2", "SA-context example 3"],
    "analogy": "A comparison to something familiar to SA learners"
  },
  "vocabulary": [
    {"term": "...", "definition": "...", "used_in_sentence": "..."}
  ],
  "worked_examples": [
    {
      "id": "we1",
      "level": "basic",
      "problem": "...",
      "full_solution": "Every single step shown. No steps skipped. MINIMUM 60 words.",
      "what_to_notice": "The key learning point"
    }
    /* 3 worked examples: basic, intermediate, advanced */
  ],
  "common_mistakes": [
    {"mistake": "Students often...", "why_wrong": "...", "correct_approach": "..."}
  ],
  "practice_questions": [
    /* 5 questions with hints and full explanations */
  ],
  "exam_readiness_checklist": [
    "I can define [concept] in my own words",
    "I can identify [concept] in a question",
    "I can solve a basic [concept] problem",
    "I can solve an advanced [concept] problem"
  ]
}`;
  }

  return '';
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildCAPSPrompt(params: Record<string, unknown>): string {
  const {
    grade,
    subject,
    topic,
    exam_type,
    difficulty,
    num_questions,
    language,
    include_answers,
    term,
    accessible_language,
    home_language,
  } = params as {
    grade: string;
    subject: string;
    topic?: string;
    exam_type: ExamType;
    difficulty?: string;
    num_questions?: number;
    language?: string;
    include_answers?: boolean;
    term?: number;
    accessible_language?: boolean;
    home_language?: string;
  };

  const phase = getCAPSPhase(grade);
  const phaseKey = phase.code;
  const subjectTopics =
    (CAPS_CURRICULUM[phaseKey]?.[subject] ??
      CAPS_CURRICULUM[phaseKey]?.['Mathematics'] ??
      []).slice(0, 6);

  const requestedQuestions = Number.isFinite(Number(num_questions)) ? Number(num_questions) : NaN;
  const defaultQuestions = exam_type === 'comprehensive_exam' ? 25 : 20;
  const numQ = Number.isFinite(requestedQuestions)
    ? Math.max(20, Math.min(50, Math.round(requestedQuestions)))
    : defaultQuestions;
  const totalMarks = exam_type === 'comprehensive_exam'
    ? (phase.gradeNum <= 6 ? 50 : phase.gradeNum <= 9 ? 75 : 100)
    : numQ * 2;

  const parts: string[] = [];

  // System identity
  parts.push(`You are a certified South African CAPS curriculum specialist and examiner with expertise in ${phase.label} education.`);
  parts.push(`You create CAPS-compliant assessments that are STRICTLY aligned to the DBE (Department of Basic Education) curriculum.`);
  parts.push('');

  // Phase and curriculum context
  parts.push(`=== CAPS CURRICULUM CONTEXT ===`);
  parts.push(`Phase: ${phase.label}`);
  parts.push(`Grade: ${grade}`);
  parts.push(`Subject: ${subject}`);
  if (topic) parts.push(`Topic: ${topic}`);
  if (term) parts.push(`Term: ${term}`);
  parts.push('');
  parts.push('CAPS Learning Areas / Topics for this subject and phase:');
  subjectTopics.forEach((t, i) => parts.push(`  ${i + 1}. ${t}`));
  parts.push('');

  // Language
  const targetLang = language && language !== 'en-ZA' ? LANG_NAMES[language] || language : 'English';
  if (language && language !== 'en-ZA') {
    parts.push(`=== LANGUAGE REQUIREMENT ===`);
    parts.push(`Generate ALL content in ${targetLang}. Use vocabulary appropriate for South African learners.`);
    parts.push('');
  }

  // Accessible language mode
  if (accessible_language) {
    parts.push(`=== ACCESSIBILITY MODE ===`);
    parts.push(`This exam is for a learner who may have limited English/Afrikaans proficiency.`);
    parts.push(`- Use SHORT, SIMPLE sentences (max 15 words per sentence in questions)`);
    parts.push(`- Avoid idioms and complex vocabulary unless testing language itself`);
    parts.push(`- Use PICTURES / DIAGRAMS descriptions where possible`);
    parts.push(`- Include a simplified_text field alongside each question with a plain-language restatement`);
    if (home_language) {
      parts.push(`- Also include a ${LANG_NAMES[home_language] || home_language}_translation field for each question`);
    }
    parts.push('');
  }

  // Format-specific instructions
  const formatInstruction = buildSAExamFormatInstruction(exam_type, numQ, grade, totalMarks);
  if (formatInstruction) {
    parts.push(formatInstruction);
  } else {
    // Legacy types: practice_test, quiz, worksheet, flashcards, revision_notes, study_guide
    parts.push(`=== GENERATION TASK ===`);
    parts.push(`Generate a ${String(exam_type).replace(/_/g, ' ')} for Grade ${grade} ${subject}${topic ? ` — ${topic}` : ''}.`);

    switch (exam_type) {
      case 'practice_test':
      case 'quiz':
        parts.push(`Create ${numQ} CAPS-aligned questions.`);
        parts.push('Mix question types: multiple choice (60%), short answer (30%), extended response (10%).');
        parts.push('Each question MUST include:');
        parts.push('  - "caps_topic": the exact CAPS curriculum area');
        parts.push('  - "explanation": full concept explanation (min 80 words) — NOT just "the answer is X"');
        parts.push('  - "extended_explanation": simpler restatement with SA real-life context (min 100 words)');
        parts.push(`  - "cognitive_level": knowledge | routine_procedure | complex_procedure | problem_solving`);
        if (difficulty) parts.push(`Difficulty distribution: ${difficulty === 'mixed' ? '40% easy / 40% medium / 20% hard' : difficulty}.`);
        break;

      case 'worksheet':
        parts.push(`Create a practice worksheet with ${numQ} graduated problems.`);
        parts.push('Order: easy (40%) → medium (40%) → hard (20%).');
        parts.push('Each problem must include full worked solution and CAPS concept reference.');
        break;

      case 'flashcards':
        parts.push(`Create ${numQ} flashcard pairs:`);
        parts.push('  Front: Key term, concept, or question');
        parts.push('  Back: Definition/answer + SA real-life example + memory tip');
        parts.push('Focus on CAPS-prescribed key vocabulary and concepts.');
        break;

      case 'revision_notes':
        parts.push('Create comprehensive CAPS-aligned revision notes:');
        parts.push('1. Summary of all key concepts with CAPS topic references');
        parts.push('2. Essential formulas / definitions (boxed, highlighted)');
        parts.push('3. Common exam mistakes and how to avoid them');
        parts.push('4. Worked examples for the 3 most important concepts');
        parts.push('5. Quick-reference checklist of must-know items');
        parts.push('6. Exam technique tips specific to this subject');
        break;

      case 'study_guide':
        parts.push('Create a comprehensive study guide:');
        parts.push('1. Learning objectives (verbatim from CAPS)');
        parts.push('2. Concept explanations (use SA context: local examples, Rands, SA geography)');
        parts.push('3. Step-by-step worked examples (at least 3 per key concept)');
        parts.push('4. Practice questions with full solutions');
        parts.push('5. Self-assessment: "I can..." checklist');
        parts.push('6. Exam preparation strategy');
        break;

      case 'past_paper':
        parts.push('Generate a past-paper-style assessment:');
        parts.push('Follow DBE official exam format exactly (Section A, B, C structure).');
        parts.push('Include time allocation, instructions, and marks per question.');
        parts.push('Replicate cognitive level distribution: 25% knowledge, 45% routine procedures, 20% complex procedures, 10% problem solving.');
        break;
    }
  }

  parts.push('');
  parts.push('=== QUALITY REQUIREMENTS ===');
  parts.push('1. EVERY question must be strictly CAPS-aligned. Reference the exact curriculum topic.');
  parts.push('2. Explanations must TEACH, not just state the answer. A struggling student must be able to learn from them.');
  parts.push('3. Use South African context: rand amounts, SA places, SA examples, SA units of measurement.');
  parts.push('4. Cognitive levels must be distributed: knowledge, routine, complex, problem-solving.');
  parts.push('5. Language must be grade-appropriate — not too easy, not too difficult.');
  parts.push('6. For calculations: show EVERY step. No shortcuts.');
  parts.push('7. Mark allocations must match CAPS guidelines for the phase.');
  parts.push('');
  parts.push('CRITICAL: Return ONLY valid JSON. No preamble, no markdown code fences, no commentary.');

  if (include_answers !== false) {
    parts.push('Include complete answer key / memorandum with marking guidelines.');
  }

  return parts.join('\n');
}

// ─── Tool Definition ──────────────────────────────────────────────────────────

export const ExamPrepTool: Tool = {
  id: 'exam_prep_generate',
  name: 'CAPS Exam Preparation Generator',
  description:
    'Generate strictly CAPS-aligned exam materials for South African Grades R-12. ' +
    'Supports comprehensive exams (SA Section A/B/C format), extended practice with worked examples, ' +
    'concept deep dives, revision notes, flashcards, study guides, past papers, and accessible versions ' +
    'for learners with limited English/Afrikaans proficiency. All 11 official SA languages supported.',
  category: 'education' as ToolCategory,
  riskLevel: 'low' as RiskLevel,

  allowedRoles: ['superadmin', 'principal', 'teacher', 'parent', 'student'],
  requiredTier: undefined,

  parameters: [
    { name: 'grade', type: 'string', description: 'Grade level (R, 1-12)', required: true },
    { name: 'subject', type: 'string', description: 'Subject (e.g. "Mathematics", "Natural Sciences", "English")', required: true },
    { name: 'topic', type: 'string', description: 'Specific CAPS topic or concept', required: false },
    { name: 'exam_type', type: 'string', description: 'Type of material to generate', required: true, enum: [...EXAM_TYPES] },
    { name: 'difficulty', type: 'string', description: 'Difficulty level', required: false, enum: ['easy', 'medium', 'hard', 'mixed'] },
    { name: 'num_questions', type: 'number', description: 'Number of questions (20-50; default auto by type)', required: false, validation: { min: 20, max: 50 } },
    { name: 'language', type: 'string', description: 'Content language (default en-ZA)', required: false, enum: [...SUPPORTED_LANGUAGES] },
    { name: 'include_answers', type: 'boolean', description: 'Include memorandum / answer key', required: false },
    { name: 'term', type: 'number', description: 'School term (1-4)', required: false, validation: { min: 1, max: 4 } },
    { name: 'interactive', type: 'boolean', description: 'Format for interactive in-app rendering', required: false },
    {
      name: 'accessible_language',
      type: 'boolean',
      description: 'Accessibility mode: simple sentences, plain language, simplified_text per question',
      required: false,
    },
    {
      name: 'home_language',
      type: 'string',
      description: 'Student home language (BCP-47 code). Adds home-language translation per question when accessible_language=true.',
      required: false,
      enum: [...SUPPORTED_LANGUAGES],
    },
  ] as ToolParameter[],

  claudeToolDefinition: {
    name: 'exam_prep_generate',
    description:
      'Generate strictly CAPS-aligned exam materials for South African Grades R-12. ' +
      'Types: practice_test, comprehensive_exam (SA Section A/B/C format), extended_practice (worked examples + graduated questions), ' +
      'concept_deep_dive (single concept with examples, analogies, SA context), revision_notes, flashcards, study_guide, past_paper, quiz, worksheet. ' +
      'Use accessible_language=true + home_language code for learners with limited English proficiency.',
    input_schema: {
      type: 'object' as const,
      properties: {
        grade: { type: 'string', description: 'Grade level (R, 1-12)' },
        subject: { type: 'string', description: 'Subject area' },
        topic: { type: 'string', description: 'Specific CAPS topic or concept' },
        exam_type: {
          type: 'string',
          enum: [...EXAM_TYPES],
          description: 'Type of material',
        },
        difficulty: { type: 'string', enum: ['easy', 'medium', 'hard', 'mixed'] },
        num_questions: { type: 'number', description: 'Number of questions (20-50)' },
        language: { type: 'string', description: 'Content language BCP-47 code (e.g. zu-ZA)' },
        include_answers: { type: 'boolean' },
        term: { type: 'number', description: 'School term 1-4' },
        interactive: { type: 'boolean' },
        accessible_language: {
          type: 'boolean',
          description: 'Accessibility mode — simple sentences, plain language restatements',
        },
        home_language: {
          type: 'string',
          description: 'Student home language BCP-47 code for in-question translations',
        },
      },
      required: ['grade', 'subject', 'exam_type'],
    },
  },

  execute: async (
    params: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> => {
    try {
      const { exam_type } = params as { exam_type: ExamType };
      const userTier = resolveCapabilityTier((context.tier ?? 'free') as string) as Tier;

      if (exam_type === 'past_paper' && !hasCapability(userTier, 'exam.pastpapers')) {
        return {
          success: false,
          error: 'Past papers require a Premium subscription. Upgrade to access official-style past papers.',
          metadata: { requiredTier: 'premium', feature: 'exam.pastpapers' },
        };
      }

      const phase = getCAPSPhase(String(params.grade ?? '7'));
      const requestedQuestions = Number.isFinite(Number(params.num_questions))
        ? Number(params.num_questions)
        : NaN;
      const normalizedQuestions = Number.isFinite(requestedQuestions)
        ? Math.max(20, Math.min(50, Math.round(requestedQuestions)))
        : (exam_type === 'comprehensive_exam' ? 25 : 20);
      const generatedPrompt = buildCAPSPrompt(params);

      return {
        success: true,
        data: {
          type: 'exam_prep_request',
          exam_type,
          grade: params.grade,
          subject: params.subject,
          topic: params.topic ?? null,
          difficulty: params.difficulty ?? 'mixed',
          language: params.language ?? 'en-ZA',
          term: params.term ?? null,
          num_questions: normalizedQuestions,
          include_answers: params.include_answers ?? true,
          interactive: params.interactive ?? true,
          accessible_language: params.accessible_language ?? false,
          home_language: params.home_language ?? null,
          caps_phase: phase.label,
          generated_prompt: generatedPrompt,
          message: `Generating CAPS-aligned ${String(exam_type).replace(/_/g, ' ')} for ${phase.label} — Grade ${params.grade} ${params.subject}${params.topic ? ` (${params.topic})` : ''}.`,
        },
        metadata: {
          toolId: 'exam_prep_generate',
          tier: userTier,
          capsPhase: phase.label,
        },
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: `Failed to prepare exam content: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

export default ExamPrepTool;
