// AI Year Plan Prompt Builder - Extracted for WARP.md compliance

import type { YearPlanConfig } from '@/components/principal/ai-planner/types';

export const YEAR_PLAN_SYSTEM_PROMPT = `You are an expert Early Childhood Development (ECD) curriculum planner in South Africa. 
Generate a comprehensive academic year plan that is:
- Developmentally appropriate for the specified age groups
- Aligned with South African CAPS curriculum where applicable
- Practical and achievable for a typical preschool
- Budget-conscious based on the specified budget level

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
  "budgetEstimate": "string"
}`;

export function buildYearPlanUserPrompt(config: YearPlanConfig): string {
  const considerations = config.specialConsiderations 
    ? `- Special considerations: ${config.specialConsiderations}` 
    : '';
    
  return `Generate a year plan for ${config.academicYear} with the following requirements:
- Number of terms: ${config.numberOfTerms}
- Age groups: ${config.ageGroups.join(', ')} years
- Focus areas: ${config.focusAreas.join(', ')}
- Include excursions: ${config.includeExcursions ? 'Yes' : 'No'}
- Include meetings: ${config.includeMeetings ? 'Yes' : 'No'}
- Budget level: ${config.budgetLevel}
${considerations}

Generate approximately 10 weekly themes per term with relevant activities.
For excursions, suggest 2-3 per term that are educational and age-appropriate.
For meetings, include staff meetings, parent meetings, and curriculum planning sessions.`;
}
