import { enforceCriteriaResponseWithSingleRewrite } from '@/features/dash-ai/criteriaEnforcement';

describe('criteriaEnforcement', () => {
  const userInput = [
    'Please help me answer these assessment criteria:',
    'a) Planning and delivery of learning programme',
    'b) All areas of learning including literacy, numeracy and life skills are covered',
  ].join('\n');

  it('runs one corrective rewrite pass when labels/headings mismatch', async () => {
    const rewriteAttempt = jest.fn().mockResolvedValue([
      'a) Planning and delivery of learning programme',
      'We plan and deliver lessons daily with structured activities.',
      '',
      'b) All areas of learning including literacy, numeracy and life skills are covered',
      'Our timetable covers literacy, numeracy, and life skills each week.',
    ].join('\n'));

    const result = await enforceCriteriaResponseWithSingleRewrite({
      userInput,
      responseContent: [
        'a) Planning and delivery of learning programme',
        'Initial answer.',
        '',
        'b) Curriculum alignment',
        'This heading is wrong.',
      ].join('\n'),
      rewriteAttempt,
    });

    expect(rewriteAttempt).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe('corrected');
    expect(result.finalValidation?.valid).toBe(true);
  });

  it('passes without rewrite when headings already match', async () => {
    const rewriteAttempt = jest.fn();
    const responseContent = [
      'a) Planning and delivery of learning programme',
      'We plan and deliver lessons daily with structured activities.',
      '',
      'b) All areas of learning including literacy, numeracy and life skills are covered',
      'Our timetable covers literacy, numeracy, and life skills each week.',
    ].join('\n');

    const result = await enforceCriteriaResponseWithSingleRewrite({
      userInput,
      responseContent,
      rewriteAttempt,
    });

    expect(result.outcome).toBe('passed');
    expect(result.rewriteAttempted).toBe(false);
    expect(rewriteAttempt).not.toHaveBeenCalled();
  });
});
