/**
 * OCR prompt pack and intent helpers used by web Dash chat flows.
 */

export type OCRTask = 'homework' | 'document' | 'handwriting';

export const HOMEWORK_SCAN_PROMPT = [
  'OCR HOMEWORK SCAN:',
  '- Read all visible handwritten and printed text.',
  '- Identify subject, topic, and likely grade level.',
  '- If answers are present, evaluate correctness briefly.',
  '- Return uncertain text with [?] markers.',
  '- Provide kind, practical next-step feedback for learner and parent.',
].join('\n');

export const DOCUMENT_SCAN_PROMPT = [
  'OCR DOCUMENT SCAN:',
  '- Extract all text visible in the document image.',
  '- Preserve structure (headings, bullets, numbered steps) where possible.',
  '- Return uncertain words with [?].',
  '- Summarize the document in plain language.',
].join('\n');

export const HANDWRITING_ANALYSIS_PROMPT = [
  'OCR HANDWRITING ANALYSIS:',
  '- Read as much handwritten text as possible.',
  '- Mark uncertain readings with [?].',
  '- Assess handwriting legibility and letter formation.',
  '- For preschool learners, include short fine-motor practice suggestions.',
].join('\n');

const OCR_PATTERNS: Array<{ task: OCRTask; pattern: RegExp }> = [
  { task: 'homework', pattern: /\b(homework|worksheet|assignment|grade this|mark this)\b/i },
  { task: 'handwriting', pattern: /\b(handwriting|write|letter formation|trace|motor skills?)\b/i },
  { task: 'document', pattern: /\b(scan|read this document|extract text|ocr|photo of notes|page)\b/i },
];

export function detectOCRTask(text: string): OCRTask | null {
  const value = String(text || '').trim();
  if (!value) return null;
  for (const item of OCR_PATTERNS) {
    if (item.pattern.test(value)) return item.task;
  }
  return null;
}

export function isOCRIntent(text: string): boolean {
  return detectOCRTask(text) !== null;
}

export function getOCRPromptForTask(task: OCRTask | null | undefined): string {
  switch (task) {
    case 'homework':
      return HOMEWORK_SCAN_PROMPT;
    case 'handwriting':
      return HANDWRITING_ANALYSIS_PROMPT;
    case 'document':
    default:
      return DOCUMENT_SCAN_PROMPT;
  }
}

