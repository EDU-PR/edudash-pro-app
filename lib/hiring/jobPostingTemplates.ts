import { storage } from '@/lib/storage';
import { EmploymentType } from '@/types/hiring';

export type JobPostingTemplate = {
  id: string;
  name: string;
  category: 'ecd' | 'assistant' | 'aftercare' | 'admin' | 'general';
  title: string;
  employment_type: EmploymentType;
  description: string;
  requirements: string;
  salary_min?: string;
  salary_max?: string;
};

export const DEFAULT_JOB_POSTING_TEMPLATES: JobPostingTemplate[] = [
  {
    id: 'tpl_ecd_teacher',
    name: 'ECD Teacher (Preschool)',
    category: 'ecd',
    title: 'Early Childhood Development (ECD) Teacher',
    employment_type: EmploymentType.FULL_TIME,
    description:
      'We are looking for a caring, energetic ECD Teacher to join our preschool team.\n\n' +
      'Responsibilities:\n' +
      '- Plan and deliver age-appropriate activities aligned to the curriculum\n' +
      '- Create a safe, engaging classroom environment\n' +
      '- Observe and record learner progress\n' +
      '- Communicate with parents/guardians professionally\n' +
      '- Support routines (arrival, meals, hygiene, nap time)\n\n' +
      'What we offer:\n' +
      '- Supportive team culture\n' +
      '- Training and growth opportunities',
    requirements:
      'Minimum requirements:\n' +
      '- Relevant ECD qualification (e.g. NQF Level 4 or higher)\n' +
      '- Experience working with young children (preferred)\n' +
      '- Strong communication skills\n' +
      '- Police clearance or willing to obtain\n\n' +
      'Nice to have:\n' +
      '- First Aid certificate\n' +
      '- Passion for play-based learning',
  },
  {
    id: 'tpl_assistant_teacher',
    name: 'Assistant Teacher',
    category: 'assistant',
    title: 'Assistant Teacher',
    employment_type: EmploymentType.FULL_TIME,
    description:
      'We are hiring an Assistant Teacher to support classroom learning and daily routines.\n\n' +
      'Responsibilities:\n' +
      '- Support the lead teacher during lessons and activities\n' +
      '- Help prepare learning materials and classroom spaces\n' +
      '- Supervise learners during play and transitions\n' +
      '- Help with basic admin and communication\n\n' +
      'This role is ideal for someone who is patient, reliable, and eager to grow in education.',
    requirements:
      'Minimum requirements:\n' +
      '- Matric (Grade 12) or equivalent\n' +
      '- Experience with children (formal or informal)\n' +
      '- Professional, punctual, and team-oriented\n\n' +
      'Nice to have:\n' +
      '- ECD qualification in progress\n' +
      '- First Aid certificate',
  },
  {
    id: 'tpl_aftercare',
    name: 'Aftercare Supervisor',
    category: 'aftercare',
    title: 'Aftercare Supervisor',
    employment_type: EmploymentType.PART_TIME,
    description:
      'We are looking for an Aftercare Supervisor to support learners after school.\n\n' +
      'Responsibilities:\n' +
      '- Supervise learners during aftercare\n' +
      '- Help with homework routines (when applicable)\n' +
      '- Manage activities, snacks, and safe pick-up procedures\n' +
      '- Maintain a calm, structured environment',
    requirements:
      'Minimum requirements:\n' +
      '- Experience supervising children\n' +
      '- Strong communication and reliability\n' +
      '- Able to manage groups and routines\n\n' +
      'Nice to have:\n' +
      '- Education / childcare training\n' +
      '- First Aid certificate',
  },
  {
    id: 'tpl_admin',
    name: 'School Administrator',
    category: 'admin',
    title: 'School Administrator',
    employment_type: EmploymentType.FULL_TIME,
    description:
      'We are hiring a School Administrator to support daily operations.\n\n' +
      'Responsibilities:\n' +
      '- Front desk and parent communication\n' +
      '- Filing, data capture, and basic reporting\n' +
      '- Scheduling support and staff coordination\n' +
      '- Manage admissions/enquiries and general office tasks',
    requirements:
      'Minimum requirements:\n' +
      '- Strong computer skills (email, spreadsheets)\n' +
      '- Professional communication\n' +
      '- Organized and detail-oriented\n\n' +
      'Nice to have:\n' +
      '- Experience in a school environment\n' +
      '- Familiarity with admin systems',
  },
];

export type SavedJobPostingTemplate = JobPostingTemplate & {
  created_at: string;
  updated_at?: string;
};

function templatesKey(params: { preschoolId: string; userId: string }) {
  return `job_posting_templates:v1:${params.preschoolId}:${params.userId}`;
}

export async function loadSavedJobPostingTemplates(params: { preschoolId: string; userId: string }): Promise<SavedJobPostingTemplate[]> {
  const raw = await storage.getItem(templatesKey(params));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SavedJobPostingTemplate[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => Boolean(t?.id && t?.name));
  } catch {
    return [];
  }
}

export async function saveSavedJobPostingTemplates(params: { preschoolId: string; userId: string; templates: SavedJobPostingTemplate[] }): Promise<void> {
  await storage.setItem(templatesKey(params), JSON.stringify(params.templates));
}

