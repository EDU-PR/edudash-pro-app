// AI Year Plan Prompt Builder - Extracted for WARP.md compliance

import type { YearPlanConfig } from '@/components/principal/ai-planner/types';
import { formatSACalendarForPrompt } from '@/lib/data/saSchoolCalendar';

const GRADE_RR_WEEKLY_STRUCTURE = [
  'Theme of the week',
  'Poem of the week',
  'Song of the week',
  'Letter of the week',
  'Language focus with new words and Monday-Friday prompt questions',
  'Fine motor progression for Monday-Friday',
  'Gross motor progression for Monday-Friday',
  'Music and movement focus',
  'Shape/colour of the week',
  'Number of the week with counting progression',
  'Art/Craft activity for the week',
];

const AGE_BAND_STRUCTURE_GUIDE: Record<string, string> = {
  '0-1': 'Care routines, sensory play, attachment, and safe movement exploration',
  '1-2': 'Toddler routines, language bursts, gross-motor safety, and self-help beginnings',
  '2-3': 'Structured play, turn-taking, emergent language, and toileting support',
  '3-4': 'Foundation pre-academics, routines, dramatic play, and concept vocabulary',
  '4-5': 'School-readiness integration across language, numeracy, life skills, and creativity',
  '5-6': 'Grade R readiness progression with structured CAPS-linked weekly outcomes',
};

export const YEAR_PLAN_SYSTEM_PROMPT = `You are an expert Early Childhood Development (ECD) curriculum planner in South Africa. 
Generate a comprehensive academic year plan that is:
- Developmentally appropriate for the specified age groups
- Aligned with South African CAPS curriculum where applicable
- Practical and achievable for a typical preschool
- Budget-conscious based on the specified budget level
- Deterministic for month-by-month operations (holidays, meetings, excursions, donations/fundraisers)
- Using the EXACT South African term dates and public holidays provided

Respond with valid JSON matching this structure:
{
  "academicYear": number,
  "schoolVision": "string",
  "terms": [
    {
      "termNumber": number,
      "name": "string",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "weeklyThemes": [
        {
          "week": number,
          "theme": "string",
          "description": "string",
          "activities": ["string"]
        }
      ],
      "excursions": [
        { "title": "string", "destination": "string", "suggestedDate": "YYYY-MM-DD", "learningObjectives": ["string"], "estimatedCost": "string" }
      ],
      "meetings": [
        { "title": "string", "type": "staff|parent|curriculum", "suggestedDate": "YYYY-MM-DD", "agenda": ["string"] }
      ],
      "specialEvents": ["string"]
    }
  ],
  "annualGoals": ["string"],
  "budgetEstimate": "string",
  "monthlyEntries": [
    {
      "monthIndex": 1,
      "bucket": "holidays_closures|meetings_admin|excursions_extras|donations_fundraisers",
      "subtype": "holiday|closure|staff_meeting|parent_meeting|training|excursion|extra_mural|donation_drive|fundraiser|other",
      "title": "string",
      "details": "string",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD"
    }
  ],
  "operationalHighlights": [
    {
      "title": "string",
      "description": "string"
    }
  ]
}`;

function buildAgeBandRules(config: YearPlanConfig): string[] {
  const lines: string[] = [];
  const selected = config.ageGroups
    .map((group) => ({ group, guide: AGE_BAND_STRUCTURE_GUIDE[group] || 'Age-appropriate developmental progression' }));

  if (selected.length > 0) {
    lines.push('Age-band expectations to enforce:');
    selected.forEach((entry) => {
      lines.push(`${entry.group} years: ${entry.guide}.`);
    });
  }

  if (config.separateAgeGroupTracks && selected.length > 1) {
    lines.push(
      'For every weekly theme description, include explicit adaptation lines for each selected age group using labels like "[3-4]" and "[5-6]".',
    );
  }

  return lines;
}

function buildQualityRules(config: YearPlanConfig): string[] {
  const rules: string[] = [];
  if (config.includeAssessmentGuidance) {
    rules.push(
      'Each weekly theme description must include a short assessment note (what evidence teachers should observe/check).',
    );
  }
  if (config.includeInclusionAdaptations) {
    rules.push(
      'Each weekly theme description must include one inclusion adaptation for diverse learning needs.',
    );
  }
  if (config.includeHomeLinkExtensions) {
    rules.push(
      'Each weekly theme activities list must include one simple home-link extension that families can do.',
    );
  }
  return rules;
}

export function buildYearPlanUserPrompt(config: YearPlanConfig): string {
  const considerations = config.specialConsiderations
    ? `- Special considerations: ${config.specialConsiderations}`
    : '';
  const principalRules = config.principalRules
    ? `- Principal rules (non-negotiable): ${config.principalRules}`
    : '';
  const calendarBlock = formatSACalendarForPrompt(config.academicYear);
  const excursionNote = config.includeExcursions
    ? 'Excursions are MANDATORY for preschool. Include at least 2 excursions per term.'
    : 'Include excursions if requested.';
  const weeklyThemesPerTerm = Math.ceil(52 / config.numberOfTerms);
  const frameworkNote =
    config.planningFramework === 'grade_rr_52_week'
      ? [
          'Planning framework: Grade RR 52-week structure (strictly based on /docs/52 week Planning - Grade RR (1).pdf).',
          `Generate exactly ${weeklyThemesPerTerm} weekly themes per term (52 weeks total for the year).`,
          `Weekly structure requirements: ${GRADE_RR_WEEKLY_STRUCTURE.join('; ')}.`,
          config.strictTemplateMode
            ? 'Strict template mode is ON: keep this structure every week without omission.'
            : 'Template mode is GUIDED: keep this structure but allow context-sensitive wording.',
        ].join('\n')
      : config.planningFramework === 'custom'
        ? 'Planning framework: custom ECD framework with CAPS/NCF compatibility.'
        : 'Planning framework: CAPS + NCF hybrid for South African ECD settings.';

  const ageBandRules = buildAgeBandRules(config);
  const qualityRules = buildQualityRules(config);
  const optionalRulesBlock = [
    ...ageBandRules,
    ...qualityRules,
  ];

  return `${calendarBlock}

---

Generate a year plan for ${config.academicYear} with the following requirements:
- Number of terms: ${config.numberOfTerms}
- Age groups: ${config.ageGroups.join(', ')} years
- Focus areas: ${config.focusAreas.join(', ')}
- Planning framework: ${config.planningFramework}
- Separate age-group tracks: ${config.separateAgeGroupTracks ? 'Yes' : 'No'}
- Strict template mode: ${config.strictTemplateMode ? 'Yes' : 'No'}
- Include excursions: ${config.includeExcursions ? 'Yes' : 'No'}
- Include meetings: ${config.includeMeetings ? 'Yes' : 'No'}
- Include assessment guidance: ${config.includeAssessmentGuidance ? 'Yes' : 'No'}
- Include inclusion adaptations: ${config.includeInclusionAdaptations ? 'Yes' : 'No'}
- Include home-link extensions: ${config.includeHomeLinkExtensions ? 'Yes' : 'No'}
- Budget level: ${config.budgetLevel}
${considerations}
${principalRules}

${frameworkNote}

${optionalRulesBlock.length > 0 ? optionalRulesBlock.map((line) => `- ${line}`).join('\n') : ''}

Generate approximately ${Math.ceil(52 / config.numberOfTerms)} weekly themes per term (target 52 weeks for the full academic year) with relevant activities.
${excursionNote}
For meetings, include staff meetings, parent meetings, and curriculum planning sessions.
Ensure monthlyEntries includes ALL public holidays from the calendar above.`;
}
