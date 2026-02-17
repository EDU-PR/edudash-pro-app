export type DashResponseMode = 'direct_writing' | 'explain_direct' | 'tutor_interactive';

export interface ClassifyResponseModeInput {
  text: string;
  hasAttachments?: boolean;
  hasActiveTutorSession?: boolean;
  explicitTutorMode?: boolean;
}

const DIRECT_WRITING_REGEX =
  /\b(write|rewrite|draft|compose|essay|narrative|story|paragraph|speech|letter|email|poem|summary|summarise|summarize|edit this|improve this|turn this into|based on this)\b/i;

const EXPLICIT_TUTOR_REGEX =
  /\b(quiz me|test me|practice question|drill me|assessment|diagnostic|step by step quiz|ask me one question|check my answer|mark my answer)\b/i;

const EXIT_TUTOR_REGEX =
  /\b(stop tutor|exit tutor|cancel tutor|end session|new topic|different task|stop quiz|cancel quiz|not a quiz|no quiz)\b/i;

export function isDirectWritingRequest(text: string, hasAttachments: boolean = false): boolean {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) return false;
  if (!DIRECT_WRITING_REGEX.test(normalized)) return false;

  if (hasAttachments) return true;

  // Writing prompts are usually still direct writing even without attachments.
  if (/\b(essay|story|paragraph|speech|letter|poem|narrative|rewrite|draft)\b/i.test(normalized)) {
    return true;
  }

  return /\b(write|compose|summari[sz]e|edit|improve)\b/i.test(normalized);
}

export function isExplicitTutorInteractiveIntent(text: string): boolean {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) return false;
  if (isDirectWritingRequest(normalized, false)) return false;
  return EXPLICIT_TUTOR_REGEX.test(normalized);
}

export function isTutorExitIntent(text: string): boolean {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) return false;
  return EXIT_TUTOR_REGEX.test(normalized);
}

export function classifyResponseMode(input: ClassifyResponseModeInput): DashResponseMode {
  const text = String(input.text || '');
  const hasAttachments = input.hasAttachments === true;

  if (isDirectWritingRequest(text, hasAttachments)) {
    return 'direct_writing';
  }

  if (isTutorExitIntent(text)) {
    return 'explain_direct';
  }

  if (input.explicitTutorMode || input.hasActiveTutorSession) {
    return 'tutor_interactive';
  }

  if (isExplicitTutorInteractiveIntent(text)) {
    return 'tutor_interactive';
  }

  return 'explain_direct';
}
