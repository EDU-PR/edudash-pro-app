// AI Year Plan Prompt Builder - Extracted for WARP.md compliance

import type { YearPlanConfig } from '@/components/principal/ai-planner/types';
import { formatSACalendarForPrompt } from '@/lib/data/saSchoolCalendar';

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
        { "week": number, "theme": "string", "description": "string", "activities": ["string"] }
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

export function buildYearPlanUserPrompt(config: YearPlanConfig): string {
  const considerations = config.specialConsiderations
    ? `- Special considerations: ${config.specialConsiderations}`
    : '';
  const calendarBlock = formatSACalendarForPrompt(config.academicYear);
  const excursionNote = config.includeExcursions
    ? 'Excursions are MANDATORY for preschool. Include at least 2 excursions per term.'
    : 'Include excursions if requested.';

  return `${calendarBlock}

---

Generate a year plan for ${config.academicYear} with the following requirements:
- Number of terms: ${config.numberOfTerms}
- Age groups: ${config.ageGroups.join(', ')} years
- Focus areas: ${config.focusAreas.join(', ')}
- Include excursions: ${config.includeExcursions ? 'Yes' : 'No'}
- Include meetings: ${config.includeMeetings ? 'Yes' : 'No'}
- Budget level: ${config.budgetLevel}
${considerations}

Generate approximately 10 weekly themes per term with relevant activities.
${excursionNote}
For meetings, include staff meetings, parent meetings, and curriculum planning sessions.
Ensure monthlyEntries includes ALL public holidays from the calendar above.`;
}
