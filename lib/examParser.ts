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
  type: 'multiple_choice' | 'short_answer' | 'essay' | 'true_false' | 'fill_blank' | 'matching';
  question: string;
  marks: number;
  options?: string[];
  correctAnswer?: string;
  rubric?: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  topic?: string;
  bloomsLevel?: string;
}

export interface ExamSection {
  id: string;
  title: string;
  instructions?: string;
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

  return {
    id: partial.id || `q_${id}`,
    type: normalizedType,
    question: String(partial.question ?? raw.text ?? '').trim(),
    marks: Number.isFinite(normalizedMarks) ? normalizedMarks : 1,
    options: partial.options ?? raw.options,
    correctAnswer: partial.correctAnswer ?? raw.correct_answer ?? raw.answer,
    rubric: partial.rubric,
    explanation: partial.explanation,
    difficulty: partial.difficulty,
    topic: partial.topic,
    bloomsLevel: partial.bloomsLevel,
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

  // Multiple choice - exact match
  if (question.type === 'multiple_choice' && question.correctAnswer) {
    const correct = question.correctAnswer.toLowerCase();
    const isCorrect = answer === correct || answer.startsWith(correct.charAt(0));

    return {
      isCorrect,
      feedback: isCorrect ? 'Correct!' : `Incorrect. The correct answer is ${question.correctAnswer}.`,
      marks: isCorrect ? question.marks : 0,
    };
  }

  // True/false - exact match
  if (question.type === 'true_false' && question.correctAnswer) {
    const correct = question.correctAnswer.toLowerCase();
    const isCorrect = answer === correct || answer.startsWith(correct.charAt(0));

    return {
      isCorrect,
      feedback: isCorrect ? 'Correct!' : `Incorrect. The correct answer is ${question.correctAnswer}.`,
      marks: isCorrect ? question.marks : 0,
    };
  }

  // For short answer and essay, require AI grading
  return {
    isCorrect: false,
    feedback: 'This answer requires teacher review.',
    marks: 0,
  };
}
