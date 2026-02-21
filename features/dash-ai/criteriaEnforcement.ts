import {
  buildCriteriaHeadingTemplate,
  extractCriteriaHeadings,
  isCriteriaResponseIntent,
  type CriteriaHeading,
  type CriteriaValidationResult,
  validateCriteriaLabelMapping,
} from '@/lib/dash-ai/ocrPrompts';

export type CriteriaValidationOutcome = 'skipped' | 'passed' | 'corrected' | 'failed_after_rewrite';

export type CriteriaEnforcementResult = {
  content: string;
  intentDetected: boolean;
  headings: CriteriaHeading[];
  templateBlock: string | null;
  initialValidation: CriteriaValidationResult | null;
  finalValidation: CriteriaValidationResult | null;
  outcome: CriteriaValidationOutcome;
  rewriteAttempted: boolean;
  warningCode?: 'criteria_rewrite_failed' | 'criteria_mapping_mismatch';
};

export function buildCriteriaRewritePrompt(headings: CriteriaHeading[]): string {
  const headingList = headings.map((heading) => `- ${heading.heading}`).join('\n');
  return [
    'Rewrite your last response to match these exact criteria headings and order.',
    'Rules:',
    '- Keep each heading text exactly unchanged.',
    '- Keep one section per heading.',
    '- Do not add extra headings.',
    '- Keep the response concise and directly aligned to each criterion.',
    'Exact headings:',
    headingList,
  ].join('\n');
}

export async function enforceCriteriaResponseWithSingleRewrite(params: {
  userInput: string;
  responseContent: string;
  extractedHeadings?: CriteriaHeading[];
  rewriteAttempt?: (rewritePrompt: string) => Promise<string | null>;
}): Promise<CriteriaEnforcementResult> {
  const userInput = String(params.userInput || '');
  const content = String(params.responseContent || '');
  const intentDetected = isCriteriaResponseIntent(userInput);
  const headings = Array.isArray(params.extractedHeadings) && params.extractedHeadings.length > 0
    ? params.extractedHeadings
    : extractCriteriaHeadings(userInput);
  const templateBlock = buildCriteriaHeadingTemplate(headings);

  if (!intentDetected || headings.length === 0) {
    return {
      content,
      intentDetected,
      headings,
      templateBlock,
      initialValidation: null,
      finalValidation: null,
      outcome: 'skipped',
      rewriteAttempted: false,
    };
  }

  const initialValidation = validateCriteriaLabelMapping(content, headings);
  if (initialValidation.valid) {
    return {
      content,
      intentDetected,
      headings,
      templateBlock,
      initialValidation,
      finalValidation: initialValidation,
      outcome: 'passed',
      rewriteAttempted: false,
    };
  }

  if (typeof params.rewriteAttempt !== 'function') {
    return {
      content,
      intentDetected,
      headings,
      templateBlock,
      initialValidation,
      finalValidation: initialValidation,
      outcome: 'failed_after_rewrite',
      rewriteAttempted: false,
      warningCode: 'criteria_mapping_mismatch',
    };
  }

  const rewritePrompt = buildCriteriaRewritePrompt(headings);
  try {
    const rewritten = String((await params.rewriteAttempt(rewritePrompt)) || '').trim();
    const rewrittenContent = rewritten || content;
    const finalValidation = validateCriteriaLabelMapping(rewrittenContent, headings);
    if (finalValidation.valid) {
      return {
        content: rewrittenContent,
        intentDetected,
        headings,
        templateBlock,
        initialValidation,
        finalValidation,
        outcome: 'corrected',
        rewriteAttempted: true,
      };
    }
    return {
      content: rewrittenContent,
      intentDetected,
      headings,
      templateBlock,
      initialValidation,
      finalValidation,
      outcome: 'failed_after_rewrite',
      rewriteAttempted: true,
      warningCode: 'criteria_mapping_mismatch',
    };
  } catch {
    return {
      content,
      intentDetected,
      headings,
      templateBlock,
      initialValidation,
      finalValidation: initialValidation,
      outcome: 'failed_after_rewrite',
      rewriteAttempted: true,
      warningCode: 'criteria_rewrite_failed',
    };
  }
}
