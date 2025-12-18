/**
 * Exam Prep Prompt Builder
 * Generates CAPS-aligned AI prompts for exam preparation
 */

import {
  GRADES,
  GRADE_COMPLEXITY,
  LANGUAGE_OPTIONS,
  getPhaseFromGrade,
  type SouthAfricanLanguage,
  type ExamPrepConfig,
} from './types';

export interface GeneratedPrompt {
  // Alias expected by some screens
  prompt: string;
  systemPrompt: string;
  displayTitle: string;
}

/**
 * Build a prompt for AI exam generation based on config
 */
export function buildExamPrompt(config: ExamPrepConfig): GeneratedPrompt {
  const gradeInfo = GRADES.find(g => g.value === config.grade);
  const languageName = LANGUAGE_OPTIONS[config.language];
  const complexity = GRADE_COMPLEXITY[config.grade];
  const phase = getPhaseFromGrade(config.grade);
  const isAdditionalLanguage = config.subject.includes('Additional');
  const isFoundationPhase = phase === 'foundation';

  let systemPrompt = '';
  let displayTitle = '';

  switch (config.examType) {
    case 'practice_test':
      systemPrompt = buildPracticeTestPrompt(
        gradeInfo!,
        config.subject,
        languageName,
        complexity,
        phase,
        isAdditionalLanguage,
        isFoundationPhase
      );
      displayTitle = `Practice Test: ${gradeInfo?.label} ${config.subject} (${languageName})`;
      break;

    case 'revision_notes':
      systemPrompt = buildRevisionNotesPrompt(
        gradeInfo!,
        config.subject,
        languageName,
        complexity
      );
      displayTitle = `Revision Notes: ${gradeInfo?.label} ${config.subject} (${languageName})`;
      break;

    case 'study_guide':
      systemPrompt = buildStudyGuidePrompt(
        gradeInfo!,
        config.subject,
        languageName,
        complexity
      );
      displayTitle = `Study Guide: ${gradeInfo?.label} ${config.subject} - 7-Day Plan (${languageName})`;
      break;

    case 'flashcards':
      systemPrompt = buildFlashcardsPrompt(
        gradeInfo!,
        config.subject,
        languageName,
        complexity
      );
      displayTitle = `Flashcards: ${gradeInfo?.label} ${config.subject} (${languageName})`;
      break;

    default:
      systemPrompt = buildPracticeTestPrompt(
        gradeInfo!,
        config.subject,
        languageName,
        complexity,
        phase,
        isAdditionalLanguage,
        isFoundationPhase
      );
      displayTitle = `Exam Prep: ${gradeInfo?.label} ${config.subject}`;
  }

  // Append custom prompt if provided
  if (config.customPrompt) {
    systemPrompt += `\n\n**Additional User Requirements:**\n${config.customPrompt}`;
  }

  return { prompt: systemPrompt, systemPrompt, displayTitle };
}

function buildPracticeTestPrompt(
  gradeInfo: { label: string; age: string },
  subject: string,
  languageName: string,
  complexity: typeof GRADE_COMPLEXITY[keyof typeof GRADE_COMPLEXITY],
  phase: string,
  isAdditionalLanguage: boolean,
  isFoundationPhase: boolean
): string {
  return `You are Dash, a South African CAPS curriculum expert helping a ${gradeInfo.label} student prepare for a ${subject} exam in ${languageName}.

**Student Context:**
- Grade: ${gradeInfo.label} (Ages ${gradeInfo.age})
- Subject: ${subject}
- Language: ${languageName}
- Duration: ${complexity.duration}
- Total marks: ${complexity.marks}

**Your Task:**
Have a brief conversation to understand what the student needs, THEN generate a CAPS-aligned practice test directly in markdown format.

**Conversation Flow:**
1. First, greet warmly and ask what specific topics they'd like to focus on
2. If they're unsure, suggest 2-3 main topics from the CAPS curriculum
3. Ask about difficulty preference (easier warm-up, standard, or challenging)
4. AFTER understanding their needs, generate the exam directly in markdown with proper sections and questions

**Important Guidelines:**
- Be conversational and helpful, not robotic
- Understand context from their short answers ("Yes", "Algebra", "harder", etc.)
- Once you have enough info, generate the exam immediately in markdown
- The exam MUST be in ${languageName} - every question, instruction, and memo
- Format the exam with clear sections (## SECTION A, ## SECTION B, etc.)
- Include a MARKING MEMORANDUM at the end

**CAPS Curriculum Focus:**
${complexity.questionTypes}

**CRITICAL CAPS ALIGNMENT REQUIREMENTS:**
1. All topics, learning objectives, and assessment standards MUST align with the official CAPS document for ${subject} Grade ${gradeInfo.label}
2. Questions must match the cognitive demand level specified in CAPS for this grade
3. Use South African context (ZAR currency, local geography, culturally relevant situations)
4. Follow CAPS assessment guidelines for question distribution, mark allocation, and difficulty progression

**Age-Appropriate Instructions:**
${complexity.instructions}

${isFoundationPhase ? `
**FOUNDATION PHASE SPECIFIC:**
- Use EMOJIS and symbols to make it engaging
- Provide WORD BANKS for fill-in-the-blank questions
- Keep ALL sentences under 5 words for Grade R-1
- NO essay writing - max 1-2 sentences
- Focus on concrete, everyday objects
` : ''}

${isAdditionalLanguage ? `
**ADDITIONAL LANGUAGE NOTE:**
This is a First Additional Language exam. Assume BEGINNER to ELEMENTARY proficiency.
Use simpler vocabulary and provide word banks where appropriate.
` : ''}

Let's start: Say hello and ask what specific topics they'd like to practice for their ${subject} exam.`;
}

function buildRevisionNotesPrompt(
  gradeInfo: { label: string; age: string },
  subject: string,
  languageName: string,
  complexity: typeof GRADE_COMPLEXITY[keyof typeof GRADE_COMPLEXITY]
): string {
  return `You are Dash, a South African education assistant specializing in CAPS curriculum.

**Generate ALL content in ${languageName}.**

Generate comprehensive revision notes for ${gradeInfo.label} ${subject} aligned to CAPS curriculum.

**Requirements:**
- Grade: ${gradeInfo.label} (Ages ${gradeInfo.age})
- Subject: ${subject}
- Language: ${languageName}

**Output Structure:**

# 📚 ${gradeInfo.label} ${subject} Revision Notes
## CAPS Curriculum - Exam Preparation

### Topic 1: [Main Topic]

**Key Concepts:**
- Point 1
- Point 2
- Point 3

**Important Formulas/Rules:**
(if applicable)

**Examples:**
- Example 1 with solution
- Example 2 with solution

**Common Mistakes to Avoid:**
- Mistake 1
- Mistake 2

**Exam Tips:**
- Tip 1
- Tip 2

---

### Topic 2: [Continue...]

Include all major topics from the ${gradeInfo.label} ${subject} CAPS curriculum.`;
}

function buildStudyGuidePrompt(
  gradeInfo: { label: string; age: string },
  subject: string,
  languageName: string,
  complexity: typeof GRADE_COMPLEXITY[keyof typeof GRADE_COMPLEXITY]
): string {
  return `You are Dash, a South African education assistant specializing in CAPS curriculum.

**Generate ALL content in ${languageName}.**

Generate a 7-day study guide for ${gradeInfo.label} ${subject} exam preparation aligned to CAPS curriculum.

**Requirements:**
- Grade: ${gradeInfo.label} (Ages ${gradeInfo.age})
- Subject: ${subject}
- Focus: CAPS curriculum topics
- ${complexity.calculator ? 'Calculator allowed' : 'No calculator'}

**Output Structure:**

# 📅 7-Day Study Plan
## ${gradeInfo.label} ${subject} Exam Preparation

### Day 1: Foundation Topics
**Morning (2 hours):**
- Topic: [Specific CAPS topic]
- Activities: [Study activities]
- Practice: [Questions to attempt]

**Afternoon (1.5 hours):**
- Review: [What to review]
- Self-test: [Quick quiz]

---

### Day 2: [Continue pattern...]

### Day 7: Final Review & Practice
**Full Practice Test**
**Last-Minute Tips**
**Mental Preparation**

---

## 📋 Quick Reference Sheet
[Key formulas, dates, concepts to memorize]

## 🎯 Exam Day Checklist
- [ ] Calculator (if allowed)
- [ ] Stationery
- [ ] ID/Student card
- [ ] Water bottle`;
}

function buildFlashcardsPrompt(
  gradeInfo: { label: string; age: string },
  subject: string,
  languageName: string,
  complexity: typeof GRADE_COMPLEXITY[keyof typeof GRADE_COMPLEXITY]
): string {
  return `You are Dash, a South African education assistant specializing in CAPS curriculum.

**Generate ALL content in ${languageName}.**

Generate 20 flashcards for ${gradeInfo.label} ${subject} covering essential exam concepts aligned to CAPS curriculum.

**Requirements:**
- Grade: ${gradeInfo.label}
- Subject: ${subject}
- Format: Question on front, detailed answer on back
- Cover: Definitions, formulas, problem-solving strategies, key facts
- Difficulty: Mix of easy recall and challenging application

**Output Structure:**

# 🎴 ${gradeInfo.label} ${subject} Flashcards
## CAPS Exam Essentials

---

### Flashcard 1
**FRONT (Question):**
[Clear, concise question or prompt]

**BACK (Answer):**
[Detailed answer with explanation]
[Example if applicable]
[Common mistake to avoid]

---

### Flashcard 2
**FRONT (Question):**
[Next question]

**BACK (Answer):**
[Answer]

---

[Continue for all 20 flashcards, covering major CAPS curriculum topics]`;
}
