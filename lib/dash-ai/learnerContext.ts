/**
 * Learner Context Utilities
 * 
 * Helper functions for determining learner age bands, grade formatting,
 * and context-specific settings for Dash AI.
 */

export interface LearnerContext {
  ageBand?: string | null;
  ageYears?: number | null;
  grade?: string | null;
  schoolType?: string | null;
  role?: string | null;
  childName?: string | null;
  learnerName?: string | null;
  subject?: string | null;
  subjects?: string[] | null;
}

/**
 * Resolves age band from age or grade
 */
export function resolveAgeBand(ageYears?: number | null, grade?: string | null): string | null {
  const raw = (grade || '').toString().toLowerCase();
  const gradeNum = raw.startsWith('r')
    ? 0
    : (() => {
        const match = raw.match(/(\d{1,2})/);
        return match ? Number(match[1]) : null;
      })();

  if (typeof gradeNum === 'number' && !Number.isNaN(gradeNum)) {
    if (gradeNum <= 1) return '3-5';
    if (gradeNum <= 3) return '6-8';
    if (gradeNum <= 7) return '9-12';
    if (gradeNum <= 9) return '13-15';
    if (gradeNum <= 12) return '16-18';
    return 'adult';
  }

  if (typeof ageYears === 'number' && !Number.isNaN(ageYears)) {
    if (ageYears <= 5) return '3-5';
    if (ageYears <= 8) return '6-8';
    if (ageYears <= 12) return '9-12';
    if (ageYears <= 15) return '13-15';
    if (ageYears <= 18) return '16-18';
    return 'adult';
  }

  return null;
}

/**
 * Formats grade label for display
 */
export function formatGradeLabel(grade?: string | null): string | null {
  if (!grade) return null;
  const raw = String(grade).trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.startsWith('grade')) return raw.replace(/\s+/g, ' ');
  if (lower === 'r' || lower.includes('grade r')) return 'Grade R';
  const match = raw.match(/\d+/);
  if (match) return `Grade ${match[0]}`;
  return raw;
}

/**
 * Detects if learner is in preschool/ECD context
 */
export function isPreschoolContext(learner?: LearnerContext | null): boolean {
  const schoolType = (learner?.schoolType || '').toLowerCase();
  if (schoolType.includes('preschool') || schoolType.includes('ecd') || schoolType.includes('early')) {
    return true;
  }
  if (typeof learner?.ageYears === 'number' && learner.ageYears <= 6) {
    return true;
  }
  if (learner?.ageBand === '3-5') {
    return true;
  }
  return false;
}

/**
 * Detects learning style from conversation patterns
 * Uses heuristics based on user interactions
 */
export function detectLearningStyle(messageHistory: Array<{ role: string; content: string }>): 'visual' | 'auditory' | 'kinesthetic' | 'mixed' {
  if (messageHistory.length < 3) return 'mixed';

  const userMessages = messageHistory.filter(m => m.role === 'user').map(m => m.content.toLowerCase());
  
  // Visual indicators
  const visualKeywords = ['show', 'see', 'look', 'picture', 'diagram', 'chart', 'image', 'visual', 'color', 'shape'];
  const visualScore = userMessages.reduce((score, msg) => 
    score + visualKeywords.filter(kw => msg.includes(kw)).length, 0
  );

  // Auditory indicators
  const auditoryKeywords = ['tell', 'explain', 'say', 'hear', 'sound', 'listen', 'talk', 'speak'];
  const auditoryScore = userMessages.reduce((score, msg) => 
    score + auditoryKeywords.filter(kw => msg.includes(kw)).length, 0
  );

  // Kinesthetic indicators
  const kinestheticKeywords = ['do', 'try', 'practice', 'make', 'build', 'create', 'hands-on', 'activity'];
  const kinestheticScore = userMessages.reduce((score, msg) => 
    score + kinestheticKeywords.filter(kw => msg.includes(kw)).length, 0
  );

  const total = visualScore + auditoryScore + kinestheticScore;
  if (total === 0) return 'mixed';

  // Determine dominant style (needs 40% threshold)
  const threshold = total * 0.4;
  if (visualScore > threshold) return 'visual';
  if (auditoryScore > threshold) return 'auditory';
  if (kinestheticScore > threshold) return 'kinesthetic';
  
  return 'mixed';
}

/**
 * Analyzes recent messages to detect if student is stuck
 */
export function detectStuckPattern(messageHistory: Array<{ role: string; content: string }>): boolean {
  if (messageHistory.length < 4) return false;

  const recent = messageHistory.slice(-4);
  const userMessages = recent.filter(m => m.role === 'user');

  // Check for repeated questions
  const uniqueUserMessages = new Set(userMessages.map(m => m.content.toLowerCase().trim()));
  if (uniqueUserMessages.size < userMessages.length / 2) return true;

  // Check for frustration indicators
  const frustrationKeywords = ['don\'t understand', 'confused', 'help', 'stuck', 'hard', 'difficult', 'i don\'t know', 'what', 'huh'];
  const hasFrustration = userMessages.some(m => 
    frustrationKeywords.some(kw => m.content.toLowerCase().includes(kw))
  );

  return hasFrustration;
}

/**
 * Analyzes response correctness to adjust difficulty
 */
export function suggestDifficultyAdjustment(
  correctAnswers: number,
  totalQuestions: number
): 'easier' | 'same' | 'harder' {
  if (totalQuestions < 3) return 'same';

  const accuracy = correctAnswers / totalQuestions;

  if (accuracy < 0.4) return 'easier';
  if (accuracy > 0.8) return 'harder';
  return 'same';
}
