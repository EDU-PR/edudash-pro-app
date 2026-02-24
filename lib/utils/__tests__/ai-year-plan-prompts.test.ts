import { buildYearPlanUserPrompt } from '@/lib/utils/ai-year-plan-prompts';
import type { YearPlanConfig } from '@/components/principal/ai-planner/types';

describe('buildYearPlanUserPrompt', () => {
  const baseConfig: YearPlanConfig = {
    academicYear: 2026,
    numberOfTerms: 4,
    ageGroups: ['3-4', '4-5', '5-6'],
    focusAreas: ['Language Development', 'Numeracy & Math'],
    planningFramework: 'caps_ncf_hybrid',
    strictTemplateMode: false,
    separateAgeGroupTracks: true,
    includeExcursions: true,
    includeMeetings: true,
    includeAssessmentGuidance: true,
    includeInclusionAdaptations: true,
    includeHomeLinkExtensions: true,
    budgetLevel: 'medium',
    principalRules: '',
    specialConsiderations: '',
  };

  it('injects Grade RR 52-week structure when requested', () => {
    const prompt = buildYearPlanUserPrompt({
      ...baseConfig,
      planningFramework: 'grade_rr_52_week',
      strictTemplateMode: true,
      principalRules: 'Keep weekly sequence fixed and classroom-ready.',
    });

    expect(prompt).toContain('Grade RR 52-week structure');
    expect(prompt).toContain('/docs/52 week Planning - Grade RR (1).pdf');
    expect(prompt).toContain('Poem of the week');
    expect(prompt).toContain('Fine motor progression for Monday-Friday');
    expect(prompt).toContain('Principal rules (non-negotiable): Keep weekly sequence fixed and classroom-ready.');
  });

  it('includes additional quality tracks when enabled', () => {
    const prompt = buildYearPlanUserPrompt(baseConfig);
    expect(prompt).toContain('assessment note');
    expect(prompt).toContain('inclusion adaptation');
    expect(prompt).toContain('home-link extension');
    expect(prompt).toContain('Separate age-group tracks: Yes');
  });
});
