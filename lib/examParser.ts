/**
 * Exam Parser Utility
 * 
 * Parses AI-generated exam content (markdown or structured JSON)
 * into a standardized exam structure for interactive display.
 * 
 * Ported from web app for native app usage.
 */

export interface ExamQuestion {
  id: string;
  type:
    | 'multiple_choice'
    | 'short_answer'
    | 'essay'
    | 'true_false'
    | 'fill_blank'
    | 'fill_in_blank'
    | 'matching';
  question: string;
  marks: number;
  options?: string[];
  correctAnswer?: string;
  rubric?: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  topic?: string;
  bloomsLevel?: string;
  visual?: {
    mode: 'diagram' | 'image';
    altText?: string;
    imageUrl?: string;
    diagramSpec?: Record<string, unknown>;
  };
}

export interface ExamSection {
  id: string;
  title: string;
  instructions?: string;
  readingPassage?: string;
  questions: ExamQuestion[];
  totalMarks: number;
}

export interface ParsedExam {
  title: string;
  grade: string;
  subject: string;
  duration?: number;
  totalMarks: number;
  instructions?: string;
  sections: ExamSection[];
  metadata?: {
    curriculum?: string;
    examType?: string;
    generatedAt?: string;
  };
}

/**
 * Parse markdown exam content into structured format
 */
export function parseExamMarkdown(content: string): ParsedExam | null {
  if (!content || typeof content !== 'string') return null;

  try {
    // Try parsing as JSON first
    if (content.trim().startsWith('{')) {
      const parsed = JSON.parse(content);
      if (parsed.sections || parsed.questions) {
        return normalizeExamStructure(parsed);
      }
    }

    // Parse markdown format
    const lines = content.split('\n');
    let title = '';
    let grade = '';
    let subject = '';
    let duration: number | undefined;
    let instructions = '';
    let currentSection: ExamSection | null = null;
    const sections: ExamSection[] = [];
    let currentQuestion: Partial<ExamQuestion> | null = null;
    let questionCounter = 0;
    let sectionCounter = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Extract title (first # heading)
      if (!title && line.startsWith('# ')) {
        title = line.replace(/^#\s+/, '').trim();
        continue;
      }

      // Extract metadata
      if (line.match(/grade:\s*(.+)/i)) {
        grade = line.split(':')[1].trim();
        continue;
      }
      if (line.match(/subject:\s*(.+)/i)) {
        subject = line.split(':')[1].trim();
        continue;
      }
      if (line.match(/duration:\s*(\d+)/i)) {
        duration = parseInt(line.split(':')[1].trim());
        continue;
      }

      // Section headers (## heading)
      if (line.startsWith('## ')) {
        // Save previous section
        if (currentSection && currentQuestion) {
          currentSection.questions.push(normalizeQuestion(currentQuestion, questionCounter));
          currentQuestion = null;
        }
        if (currentSection) {
          sections.push(currentSection);
        }

        // Start new section
        sectionCounter++;
        currentSection = {
          id: `section_${sectionCounter}`,
          title: line.replace(/^##\s+/, '').trim(),
          questions: [],
          totalMarks: 0,
        };
        continue;
      }

      // Question patterns
      const questionMatch = line.match(/^(\d+)\.\s+(.+)/);
      if (questionMatch) {
        // Save previous question
        if (currentSection && currentQuestion) {
          currentSection.questions.push(normalizeQuestion(currentQuestion, questionCounter));
        }

        // Start new question
        questionCounter++;
        currentQuestion = {
          id: `q_${questionCounter}`,
          question: questionMatch[2].trim(),
          marks: 1,
          type: 'short_answer',
        };
        continue;
      }

      // Parse question marks
      if (currentQuestion && line.match(/\[(\d+)\s*marks?\]/i)) {
        const marksMatch = line.match(/\[(\d+)\s*marks?\]/i);
        if (marksMatch) {
          currentQuestion.marks = parseInt(marksMatch[1]);
        }
        continue;
      }

      // Parse options (A, B, C, D format)
      if (currentQuestion && line.match(/^[A-D]\)\s+(.+)/)) {
        if (!currentQuestion.options) {
          currentQuestion.options = [];
          currentQuestion.type = 'multiple_choice';
        }
        currentQuestion.options.push(line.substring(3).trim());
        continue;
      }

      // Collect question text if we're in a question
      if (currentQuestion && line && !line.startsWith('#') && !line.startsWith('---')) {
        currentQuestion.question = (currentQuestion.question || '') + ' ' + line;
      }
    }

    // Save last question and section
    if (currentSection && currentQuestion) {
      currentSection.questions.push(normalizeQuestion(currentQuestion, questionCounter));
    }
    if (currentSection) {
      sections.push(currentSection);
    }

    // Calculate section marks
    sections.forEach(section => {
      section.totalMarks = section.questions.reduce((sum, q) => sum + q.marks, 0);
    });

    const totalMarks = sections.reduce((sum, s) => sum + s.totalMarks, 0);

    return {
      title: title || 'Generated Exam',
      grade: grade || '',
      subject: subject || '',
      duration,
      totalMarks,
      instructions,
      sections,
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('[ExamParser] Failed to parse exam:', error);
    return null;
  }
}

/**
 * Normalize question structure
 */
function normalizeQuestion(partial: Partial<ExamQuestion>, id: number): ExamQuestion {
  const raw = partial as Record<string, any>;
  const rawType = String(partial.type || raw.type || 'short_answer');
  const normalizedType: ExamQuestion['type'] =
    rawType === 'multiple_choice' ||
    rawType === 'short_answer' ||
    rawType === 'essay' ||
    rawType === 'true_false' ||
    rawType === 'matching'
      ? (rawType as ExamQuestion['type'])
      : rawType === 'fill_in_blank' || rawType === 'fill_blank'
      ? 'fill_blank'
      : 'short_answer';
  const normalizedMarks = Number(partial.marks ?? raw.points ?? 1);

  const rawOptions = partial.options ?? raw.options;
  const options = Array.isArray(rawOptions)
    ? rawOptions.map((item: unknown) =>
        String(item || '')
          .replace(/^(?:\s*[A-D]\s*[\.\)\-:]\s*)+/i, '')
          .trim(),
      )
    : undefined;

  return {
    id: partial.id || `q_${id}`,
    type: normalizedType,
    question: String(partial.question ?? raw.text ?? '').trim(),
    marks: Number.isFinite(normalizedMarks) ? normalizedMarks : 1,
    options,
    correctAnswer: partial.correctAnswer ?? raw.correct_answer ?? raw.answer,
    rubric: partial.rubric,
    explanation: partial.explanation,
    difficulty: partial.difficulty,
    topic: partial.topic,
    bloomsLevel: partial.bloomsLevel,
    visual: raw.visual && typeof raw.visual === 'object' ? (raw.visual as ExamQuestion['visual']) : undefined,
  };
}

/**
 * Normalize exam structure from various formats
 */
function normalizeExamStructure(data: any): ParsedExam {
  // Handle direct sections format
  if (Array.isArray(data.sections)) {
    return {
      title: data.title || 'Generated Exam',
      grade: data.grade || '',
      subject: data.subject || '',
      duration: data.duration,
      totalMarks: data.totalMarks || calculateTotalMarks(data.sections),
      instructions: data.instructions,
      sections: data.sections.map((s: any, i: number) => ({
        id: s.id || `section_${i + 1}`,
        title: s.title || s.name || `Section ${i + 1}`,
        instructions: s.instructions,
        readingPassage:
          typeof s.readingPassage === 'string'
            ? s.readingPassage
            : typeof s.reading_passage === 'string'
            ? s.reading_passage
            : undefined,
        questions: s.questions?.map((q: any, j: number) => normalizeQuestion(q, j + 1)) || [],
        totalMarks: s.totalMarks || calculateSectionMarks(s.questions || []),
      })),
      metadata: data.metadata || {},
    };
  }

  // Handle flat questions format
  if (Array.isArray(data.questions)) {
    const section: ExamSection = {
      id: 'section_1',
      title: 'Questions',
      questions: data.questions.map((q: any, i: number) => normalizeQuestion(q, i + 1)),
      totalMarks: calculateSectionMarks(data.questions),
    };

    return {
      title: data.title || 'Generated Exam',
      grade: data.grade || '',
      subject: data.subject || '',
      duration: data.duration,
      totalMarks: section.totalMarks,
      instructions: data.instructions,
      sections: [section],
      metadata: data.metadata || {},
    };
  }

  throw new Error('Invalid exam structure');
}

function calculateTotalMarks(sections: any[]): number {
  return sections.reduce((sum, s) => sum + (s.totalMarks || calculateSectionMarks(s.questions || [])), 0);
}

function calculateSectionMarks(questions: any[]): number {
  return questions.reduce((sum, q) => sum + (q.marks || 1), 0);
}

/**
 * Grade student answer against correct answer
 */
export function gradeAnswer(
  question: ExamQuestion,
  studentAnswer: string
): { isCorrect: boolean; feedback: string; marks: number } {
  if (!studentAnswer || !studentAnswer.trim()) {
    return {
      isCorrect: false,
      feedback: 'No answer provided.',
      marks: 0,
    };
  }

  const answer = studentAnswer.trim().toLowerCase();

  const normalize = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/^(?:\s*[a-d]\s*[\.\)\-:]\s*)+/i, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ');

  // Multiple choice - flexible matching
  if (question.type === 'multiple_choice' && question.correctAnswer) {
    const correctRaw = question.correctAnswer;
    const correctNormalized = normalize(correctRaw);
    const answerNormalized = normalize(answer);
    const answerLetter = answerNormalized.match(/^[a-d]$/)?.[0];

    let correctLetter = correctNormalized.match(/^[a-d]$/)?.[0];
    if (!correctLetter && question.options?.length) {
      const correctOptionIndex = question.options.findIndex(
        (option) => normalize(option) === correctNormalized,
      );
      if (correctOptionIndex >= 0) {
        correctLetter = String.fromCharCode(97 + correctOptionIndex);
      }
    }

    const isCorrect =
      answerNormalized === correctNormalized ||
      (!!answerLetter && !!correctLetter && answerLetter === correctLetter);

    return {
      isCorrect,
      feedback: isCorrect
        ? question.explanation || 'Correct!'
        : question.explanation
        ? `Incorrect. ${question.explanation}`
        : `Incorrect. The correct answer is ${question.correctAnswer}.`,
      marks: isCorrect ? question.marks : 0,
    };
  }

  // True/false - exact match
  if (question.type === 'true_false' && question.correctAnswer) {
    const normalizedAnswer = normalize(answer);
    const normalizedCorrect = normalize(question.correctAnswer);
    const normalizedStudent = normalizedAnswer === 't' ? 'true' : normalizedAnswer === 'f' ? 'false' : normalizedAnswer;
    const normalizedTarget = normalizedCorrect === 't' ? 'true' : normalizedCorrect === 'f' ? 'false' : normalizedCorrect;
    const isCorrect = normalizedStudent === normalizedTarget;

    return {
      isCorrect,
      feedback: isCorrect
        ? question.explanation || 'Correct!'
        : question.explanation
        ? `Incorrect. ${question.explanation}`
        : `Incorrect. The correct answer is ${question.correctAnswer}.`,
      marks: isCorrect ? question.marks : 0,
    };
  }

  if ((question.type === 'fill_blank' || question.type === 'fill_in_blank') && question.correctAnswer) {
    const isCorrect = normalize(answer) === normalize(question.correctAnswer);
    return {
      isCorrect,
      feedback: isCorrect
        ? question.explanation || 'Correct!'
        : question.explanation
        ? `Incorrect. ${question.explanation}`
        : `Incorrect. The correct answer is ${question.correctAnswer}.`,
      marks: isCorrect ? question.marks : 0,
    };
  }

  if ((question.type === 'short_answer' || question.type === 'essay') && question.correctAnswer) {
    const expectedTokens = normalize(question.correctAnswer)
      .split(' ')
      .filter((token) => token.length >= 4);
    const studentTokens = normalize(answer).split(' ');
    const matched = expectedTokens.filter((token) => studentTokens.includes(token)).length;
    const coverage = expectedTokens.length > 0 ? matched / expectedTokens.length : 0;
    const awarded = Math.min(question.marks, Math.max(0, Math.round(question.marks * coverage)));

    return {
      isCorrect: coverage >= 0.6,
      feedback:
        coverage >= 0.6
          ? question.explanation || 'Good answer. Key ideas are covered.'
          : question.explanation
          ? `Partially correct. ${question.explanation}`
          : 'Partially correct. Add more key terms and explain your reasoning.',
      marks: awarded,
    };
  }

  return {
    isCorrect: false,
    feedback: question.explanation || 'This answer requires teacher review.',
    marks: 0,
  };
}
