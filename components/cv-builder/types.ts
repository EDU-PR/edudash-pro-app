/**
 * CV Builder types and constants
 */

export interface CVSection {
  id: string;
  type: 'personal' | 'experience' | 'education' | 'skills' | 'certifications' | 'languages' | 'projects' | 'references' | 'achievements' | 'volunteer';
  title: string;
  data: any;
}

export type ViewMode = 'edit' | 'preview';

export function getSectionTitle(type: CVSection['type'], t: any): string {
  const titles: Record<CVSection['type'], string> = {
    personal: t('cv.personal_info', { defaultValue: 'Personal Information' }),
    experience: t('cv.experience', { defaultValue: 'Experience' }),
    education: t('cv.education', { defaultValue: 'Education' }),
    skills: t('cv.skills', { defaultValue: 'Skills' }),
    certifications: t('cv.certifications', { defaultValue: 'Certifications' }),
    languages: t('cv.languages', { defaultValue: 'Languages' }),
    projects: t('cv.projects', { defaultValue: 'Projects' }),
    references: t('cv.references', { defaultValue: 'References' }),
    achievements: t('cv.achievements', { defaultValue: 'Achievements' }),
    volunteer: t('cv.volunteer', { defaultValue: 'Volunteer Work' }),
  };
  return titles[type] || type;
}

export function getDefaultSectionData(type: CVSection['type']): any {
  switch (type) {
    case 'experience':
    case 'education':
    case 'certifications':
    case 'projects':
    case 'references':
    case 'achievements':
    case 'volunteer':
      return { items: [] };
    case 'skills':
      return { skills: [] };
    case 'languages':
      return { languages: [] };
    default:
      return {};
  }
}
