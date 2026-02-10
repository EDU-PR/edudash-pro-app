import {
  detectOCRTask,
  getOCRPromptForTask,
  HANDWRITING_ANALYSIS_PROMPT,
  HOMEWORK_SCAN_PROMPT,
  isOCRIntent,
} from '../ocrPrompts';

describe('ocrPrompts', () => {
  it('detects OCR task from user intent text', () => {
    expect(detectOCRTask('please scan this homework page')).toBe('homework');
    expect(detectOCRTask('analyze handwriting quality')).toBe('handwriting');
    expect(detectOCRTask('extract text from this document')).toBe('document');
    expect(detectOCRTask('tell me a joke')).toBeNull();
  });

  it('flags OCR intent correctly', () => {
    expect(isOCRIntent('read this worksheet')).toBe(true);
    expect(isOCRIntent('summarize this chapter')).toBe(false);
  });

  it('returns the correct task prompt', () => {
    expect(getOCRPromptForTask('homework')).toBe(HOMEWORK_SCAN_PROMPT);
    expect(getOCRPromptForTask('handwriting')).toBe(HANDWRITING_ANALYSIS_PROMPT);
    expect(getOCRPromptForTask(null)).toContain('OCR DOCUMENT SCAN');
  });
});
