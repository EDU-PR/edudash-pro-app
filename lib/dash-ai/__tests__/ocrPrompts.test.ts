import {
  buildCriteriaHeadingTemplate,
  detectOCRTask,
  extractCriteriaHeadings,
  getCriteriaResponsePrompt,
  getOCRPromptForTask,
  HANDWRITING_ANALYSIS_PROMPT,
  HOMEWORK_SCAN_PROMPT,
  isCriteriaResponseIntent,
  isOCRIntent,
  isShortOrAttachmentOnlyPrompt,
  validateCriteriaLabelMapping,
} from '../ocrPrompts';

describe('ocrPrompts', () => {
  it('detects OCR task from user intent text', () => {
    expect(detectOCRTask('please scan this homework page')).toBe('homework');
    expect(detectOCRTask('help met huiswerk asseblief')).toBe('homework');
    expect(detectOCRTask('ngisize ngomsebenzi wasekhaya')).toBe('homework');
    expect(detectOCRTask('analyze handwriting quality')).toBe('handwriting');
    expect(detectOCRTask('handskrif is swak, help my')).toBe('handwriting');
    expect(detectOCRTask('extract text from this document')).toBe('document');
    expect(detectOCRTask('lees hierdie dokument vir my')).toBe('document');
    expect(detectOCRTask('tell me a joke')).toBeNull();
  });

  it('flags OCR intent correctly', () => {
    expect(isOCRIntent('read this worksheet')).toBe(true);
    expect(isOCRIntent('skandeer hierdie bladsy')).toBe(true);
    expect(isOCRIntent('summarize this chapter')).toBe(false);
  });

  it('identifies short attachment-only prompts', () => {
    expect(isShortOrAttachmentOnlyPrompt('')).toBe(true);
    expect(isShortOrAttachmentOnlyPrompt('help')).toBe(true);
    expect(isShortOrAttachmentOnlyPrompt('attached files')).toBe(true);
    expect(isShortOrAttachmentOnlyPrompt('Please explain question 4 with steps')).toBe(false);
  });

  it('returns the correct task prompt', () => {
    expect(getOCRPromptForTask('homework')).toBe(HOMEWORK_SCAN_PROMPT);
    expect(getOCRPromptForTask('handwriting')).toBe(HANDWRITING_ANALYSIS_PROMPT);
    expect(getOCRPromptForTask(null)).toContain('OCR DOCUMENT SCAN');
  });

  it('detects criteria response intent', () => {
    expect(isCriteriaResponseIntent('Please help me answer this assessment criteria sheet')).toBe(true);
    expect(isCriteriaResponseIntent('Group discussion response for assessment criterion 1-5')).toBe(true);
    expect(isCriteriaResponseIntent('a) Planning b) Literacy coverage c) CAPS alignment')).toBe(true);
    expect(isCriteriaResponseIntent('Please explain photosynthesis in simple steps')).toBe(false);
  });

  it('returns criteria response prompt only when requested', () => {
    expect(getCriteriaResponsePrompt('Assist me with this rubric response')).toContain('CRITERIA RESPONSE MODE');
    expect(getCriteriaResponsePrompt('Can you explain question 4?')).toBeNull();
  });

  it('extracts exact criteria headings and builds a strict template', () => {
    const text = [
      'a) Planning and delivery of learning programme',
      'b) All areas of learning including literacy, numeracy and life skills are covered',
      'c) Planning programme based on national curriculum',
    ].join('\n');
    const headings = extractCriteriaHeadings(text);
    expect(headings).toHaveLength(3);
    expect(headings[0].heading).toBe('a) Planning and delivery of learning programme');
    expect(headings[1].heading).toContain('literacy, numeracy and life skills');
    expect(buildCriteriaHeadingTemplate(headings)).toContain('STRICT CRITERIA TEMPLATE');
  });

  it('validates criteria label count/order/heading text', () => {
    const expected = extractCriteriaHeadings([
      'a) Planning and delivery of learning programme',
      'b) All areas of learning including literacy, numeracy and life skills are covered',
    ].join('\n'));

    const valid = validateCriteriaLabelMapping([
      'a) Planning and delivery of learning programme',
      'Answer one.',
      '',
      'b) All areas of learning including literacy, numeracy and life skills are covered',
      'Answer two.',
    ].join('\n'), expected);
    expect(valid.valid).toBe(true);

    const invalid = validateCriteriaLabelMapping([
      'a) Planning and delivery of learning programme',
      'Answer one.',
      '',
      'b) Curriculum alignment',
      'Answer two.',
    ].join('\n'), expected);
    expect(invalid.valid).toBe(false);
    expect(invalid.mismatchReason).toBe('heading_text');
  });
});
