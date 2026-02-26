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

const CAPS_QUALITY_GUARDRAILS = `**NON-NEGOTIABLE QUALITY BAR (CAPS):**
- Align to official CAPS outcomes and cognitive levels for the selected grade and subject.
- Use South African context where relevant (ZAR, local examples, local terminology).
- Structure learning clearly: baseline -> guided example -> independent practice -> mastery check.
- Never skip answer quality: provide correct answers, mark allocation, and learner-friendly explanations.
- End with targeted remediation steps for common errors and what to practice next.`;

const CAPS_MASTERED_OUTPUT_REQUIREMENTS = `**MANDATORY OUTPUT BLOCKS (include all):**
1. Formal assessment content (clear sections, question numbers, mark allocation).
2. Full memorandum (correct answers + explanation per answer + mark breakdown).
3. Grading guide with performance bands and improvement actions.
4. Worked examples (at least 2 fully solved examples with reasoning).
5. Extra practice (at least 5 additional questions to consolidate understanding).
6. Quick mastery check with expected answers.`;

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

  const termLabel = config.term ? `Term ${config.term}` : '';
  const titleTermSuffix = termLabel ? ` - ${termLabel}` : '';

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
      displayTitle = `Practice Test: ${gradeInfo?.label} ${config.subject}${titleTermSuffix} (${languageName})`;
      break;

    case 'revision_notes':
      systemPrompt = buildRevisionNotesPrompt(
        gradeInfo!,
        config.subject,
        languageName,
        complexity
      );
      displayTitle = `Revision Notes: ${gradeInfo?.label} ${config.subject}${titleTermSuffix} (${languageName})`;
      break;

    case 'study_guide':
      systemPrompt = buildStudyGuidePrompt(
        gradeInfo!,
        config.subject,
        languageName,
        complexity
      );
      displayTitle = `Study Guide: ${gradeInfo?.label} ${config.subject}${titleTermSuffix} - 7-Day Plan (${languageName})`;
      break;

    case 'flashcards':
      systemPrompt = buildFlashcardsPrompt(
        gradeInfo!,
        config.subject,
        languageName,
        complexity
      );
      displayTitle = `Flashcards: ${gradeInfo?.label} ${config.subject}${titleTermSuffix} (${languageName})`;
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
      displayTitle = `Exam Prep: ${gradeInfo?.label} ${config.subject}${titleTermSuffix}`;
  }

  // Append term scoping if provided
  if (config.term) {
    systemPrompt += `\n\n**Term Scoping:**\nScope all content strictly to CAPS Term ${config.term} for ${gradeInfo?.label} ${config.subject}. Only include topics, outcomes, and assessment standards prescribed for Term ${config.term}.`;
  }

  // Append topic scoping if provided
  if (config.topics && config.topics.length > 0) {
    systemPrompt += `\n\n**Topic Focus:**\nFocus specifically on the following topics: ${config.topics.join(', ')}. Ensure all questions, examples, and content relate directly to these topics.`;
  }

  // Append custom prompt if provided
  if (config.customPrompt) {
    systemPrompt += `\n\n**Additional User Requirements:**\n${config.customPrompt}`;
  }

  if (config.useTeacherContext !== false && config.contextSummary) {
    const focusTopics = config.contextSummary.focusTopics?.slice(0, 8) || [];
    const weakTopics = config.contextSummary.weakTopics?.slice(0, 8) || [];
    const focusBlock = focusTopics.length > 0 ? focusTopics.join(', ') : 'No explicit focus topics found';
    const weakBlock = weakTopics.length > 0 ? weakTopics.join(', ') : 'No weak-topic signals available';

    systemPrompt += `\n\n**Teacher Artifact Context (Prioritize This):**
- Homework assignments found: ${config.contextSummary.assignmentCount}
- Lesson assignments found: ${config.contextSummary.lessonCount}
- Focus topics from teacher artifacts: ${focusBlock}
- Weak topics from learner performance: ${weakBlock}

Use this context to prioritize what has already been taught and assigned before introducing new material.`;
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
  return `**ABSOLUTE LANGUAGE RULE — THIS IS NON-NEGOTIABLE:**
This is a ${subject} exam. The ENTIRE exam (including the reading passage, all questions, all answer options, all instructions, and the memorandum) MUST be written in ${languageName}.
${subject === 'English Home Language' || subject === 'English First Additional Language'
    ? 'The reading passage MUST be a story/text written entirely in ENGLISH. Do NOT write the passage in Afrikaans, isiZulu, or any other language.'
    : subject.includes('Afrikaans')
      ? 'The reading passage MUST be a story/text written entirely in AFRIKAANS.'
      : `The reading passage MUST be written entirely in ${languageName}.`
  }
DO NOT include any text in a different language anywhere in the exam.

You are Dash, a South African CAPS curriculum expert helping a ${gradeInfo.label} student prepare for a ${subject} exam in ${languageName}.

**Student Context:**
- Grade: ${gradeInfo.label} (Ages ${gradeInfo.age})
- Subject: ${subject}
- Language: ${languageName}
- Duration: ${complexity.duration}
- Total marks: ${complexity.marks}

**Your Task:**
Generate a complete CAPS-aligned practice test immediately. Do NOT ask clarifying questions — generate the full exam now.

**Important Guidelines:**
- The exam MUST be in ${languageName} — every question, instruction, passage, and memo
- Format the exam with clear sections (## SECTION A, ## SECTION B, etc.)
- Include a MARKING MEMORANDUM at the end

**CAPS Curriculum Focus:**
${complexity.questionTypes}

**CRITICAL CAPS ALIGNMENT REQUIREMENTS:**
1. All topics, learning objectives, and assessment standards MUST align with the official CAPS document for ${subject} Grade ${gradeInfo.label}
2. Questions must match the cognitive demand level specified in CAPS for this grade
3. Use South African context (ZAR currency, local geography, culturally relevant situations)
4. Follow CAPS assessment guidelines for question distribution, mark allocation, and difficulty progression
5. Include an explicit memo and explanation for every scored item
6. Include extra consolidation practice and a short mastery check

**Age-Appropriate Instructions:**
${complexity.instructions}

${CAPS_QUALITY_GUARDRAILS}
${CAPS_MASTERED_OUTPUT_REQUIREMENTS}

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

**FINAL REMINDER: Every single word in this exam must be in ${languageName}. No exceptions.**`;
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
${CAPS_QUALITY_GUARDRAILS}

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

**Quick Self-Check (with Answers):**
- Include 5 short check questions.
- Provide concise correct answers and one-line explanations.

**Extra Practice:**
- Include 5 more practice questions (mixed difficulty) with answer key and short explanations.

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
${CAPS_QUALITY_GUARDRAILS}

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
- [ ] Water bottle

## ✅ Marking + Explanations Pack
- Include answer key for all included practice tasks.
- Add a short explanation for each answer.
- Include a grading guide with improvement targets for low/medium/high performance.`;
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
${CAPS_QUALITY_GUARDRAILS}

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
