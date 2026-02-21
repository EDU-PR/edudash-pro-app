// Mock Year Plan Generator - Extracted for WARP.md compliance
// Provides fallback plan when AI service is unavailable

import type { YearPlanConfig, GeneratedYearPlan, GeneratedTerm } from '@/components/principal/ai-planner/types';

const THEMES = [
  { theme: 'All About Me', description: 'Self-discovery and identity', activities: ['Self-portraits', 'Family trees', 'Feelings chart'] },
  { theme: 'My Community', description: 'Exploring helpers in our community', activities: ['Role play', 'Community walk', 'Thank you cards'] },
  { theme: 'Animals & Habitats', description: 'Learning about animals and where they live', activities: ['Animal sorting', 'Habitat dioramas', 'Animal sounds'] },
  { theme: 'Weather & Seasons', description: 'Understanding weather patterns', activities: ['Weather chart', 'Season sorting', 'Rain painting'] },
  { theme: 'Growing Things', description: 'Plants and nature', activities: ['Planting seeds', 'Nature walk', 'Leaf rubbings'] },
  { theme: 'Transport', description: 'How we get around', activities: ['Vehicle sorting', 'Traffic safety', 'Transport collage'] },
  { theme: 'Healthy Bodies', description: 'Taking care of ourselves', activities: ['Food groups', 'Exercise routines', 'Hygiene habits'] },
  { theme: 'Colours & Shapes', description: 'Visual discrimination', activities: ['Shape hunt', 'Colour mixing', 'Pattern making'] },
  { theme: 'Numbers & Counting', description: 'Early numeracy', activities: ['Counting games', 'Number art', 'Sorting activities'] },
  { theme: 'Stories & Books', description: 'Literacy and imagination', activities: ['Story time', 'Book making', 'Character dress-up'] },
];

const TERM_START_DATES = ['01-15', '04-15', '07-15', '10-01'];
const TERM_END_DATES = ['03-28', '06-28', '09-20', '12-06'];
const EXCURSION_TITLES = ['Fire Station Visit', 'Farm Visit', 'Library Visit', 'Nature Reserve'];
const EXCURSION_DESTINATIONS = ['Local Fire Station', 'Community Farm', 'Public Library', 'Nature Reserve'];

export function generateMockYearPlan(config: YearPlanConfig): GeneratedYearPlan {
  const terms: GeneratedTerm[] = [];
  const monthlyEntries: GeneratedYearPlan['monthlyEntries'] = [];

  for (let i = 0; i < config.numberOfTerms; i++) {
    const weeklyThemes = THEMES.slice(0, 10).map((t, idx) => ({
      week: idx + 1,
      ...t,
    }));

    const budgetCost = config.budgetLevel === 'low' 
      ? 'R50 per child' 
      : config.budgetLevel === 'medium' 
        ? 'R100 per child' 
        : 'R150 per child';

    terms.push({
      termNumber: i + 1,
      name: `Term ${i + 1}`,
      startDate: `${config.academicYear}-${TERM_START_DATES[i]}`,
      endDate: `${config.academicYear}-${TERM_END_DATES[i]}`,
      weeklyThemes,
      excursions: config.includeExcursions ? [
        {
          title: EXCURSION_TITLES[i],
          destination: EXCURSION_DESTINATIONS[i],
          suggestedDate: `${config.academicYear}-${TERM_START_DATES[i].split('-')[0]}-20`,
          learningObjectives: ['Community awareness', 'Safety rules', 'Asking questions'],
          estimatedCost: budgetCost,
        },
      ] : [],
      meetings: config.includeMeetings ? [
        {
          title: 'Staff Planning Meeting',
          type: 'staff',
          suggestedDate: `${config.academicYear}-${TERM_START_DATES[i].split('-')[0]}-10`,
          agenda: ['Term overview', 'Resource needs', 'Special events'],
        },
        {
          title: 'Parent Information Evening',
          type: 'parent',
          suggestedDate: `${config.academicYear}-${TERM_START_DATES[i].split('-')[0]}-25`,
          agenda: ['Term themes', 'Assessment schedule', 'Q&A'],
        },
      ] : [],
      specialEvents: [`Term ${i + 1} Concert`, i === 3 ? 'Graduation Ceremony' : 'Sports Day'],
    });

    const startMonth = Number(TERM_START_DATES[i].split('-')[0]);
    monthlyEntries.push({
      monthIndex: startMonth,
      bucket: 'holidays_closures',
      subtype: 'closure',
      title: `Term ${i + 1} starts`,
      details: `Welcome and orientation for Term ${i + 1}`,
      startDate: `${config.academicYear}-${TERM_START_DATES[i]}`,
      endDate: `${config.academicYear}-${TERM_START_DATES[i]}`,
      source: 'ai',
      isPublished: false,
      publishedToCalendar: false,
    });

    monthlyEntries.push({
      monthIndex: startMonth,
      bucket: 'meetings_admin',
      subtype: 'staff_meeting',
      title: 'Staff Planning Meeting',
      details: 'Term readiness and resource alignment',
      startDate: `${config.academicYear}-${TERM_START_DATES[i].split('-')[0]}-10`,
      endDate: `${config.academicYear}-${TERM_START_DATES[i].split('-')[0]}-10`,
      source: 'ai',
      isPublished: false,
      publishedToCalendar: false,
    });

    monthlyEntries.push({
      monthIndex: startMonth,
      bucket: 'excursions_extras',
      subtype: 'excursion',
      title: EXCURSION_TITLES[i],
      details: EXCURSION_DESTINATIONS[i],
      startDate: `${config.academicYear}-${TERM_START_DATES[i].split('-')[0]}-20`,
      endDate: `${config.academicYear}-${TERM_START_DATES[i].split('-')[0]}-20`,
      source: 'ai',
      isPublished: false,
      publishedToCalendar: false,
    });

    monthlyEntries.push({
      monthIndex: startMonth + 1 <= 12 ? startMonth + 1 : startMonth,
      bucket: 'donations_fundraisers',
      subtype: i % 2 === 0 ? 'fundraiser' : 'donation_drive',
      title: i % 2 === 0 ? 'Community Bake Sale' : 'Seasonal Donation Drive',
      details: 'Family and community participation campaign',
      startDate: `${config.academicYear}-${String(Math.min(12, startMonth + 1)).padStart(2, '0')}-15`,
      endDate: `${config.academicYear}-${String(Math.min(12, startMonth + 1)).padStart(2, '0')}-15`,
      source: 'ai',
      isPublished: false,
      publishedToCalendar: false,
    });
  }

  const budgetEstimate = config.budgetLevel === 'low'
    ? 'R15,000 - R25,000'
    : config.budgetLevel === 'medium'
      ? 'R30,000 - R50,000'
      : 'R60,000 - R100,000';

  return {
    academicYear: config.academicYear,
    schoolVision: 'To nurture curious, confident, and caring young learners through play-based education.',
    terms,
    annualGoals: [
      'Develop foundational literacy and numeracy skills',
      'Foster social-emotional development',
      'Encourage creativity and self-expression',
      'Build strong school-home partnerships',
    ],
    budgetEstimate,
    monthlyEntries,
    operationalHighlights: [
      {
        title: 'Fundraising Mix',
        description: 'Combines quick-win fundraisers with seasonal donation drives.',
      },
      {
        title: 'Monthly Operational Rhythm',
        description: 'Each term includes closures, meetings, excursions, and community support events.',
      },
    ],
  };
}
