/**
 * CV Templates
 * Professional CV templates with different styles
 */

export type CVTemplate = 'modern' | 'classic' | 'minimal' | 'creative' | 'executive';

export interface TemplateColors {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  textLight: string;
  background: string;
  headerBg: string;
}

export const TEMPLATE_CONFIGS: Record<CVTemplate, {
  name: string;
  description: string;
  colors: TemplateColors;
  layout: 'single' | 'two-column' | 'sidebar';
  headerStyle: 'centered' | 'left' | 'banner';
  sectionStyle: 'underline' | 'box' | 'minimal' | 'icon';
}> = {
  modern: {
    name: 'Modern',
    description: 'Clean and professional with a touch of color',
    colors: {
      primary: '#2563EB',
      secondary: '#3B82F6',
      accent: '#60A5FA',
      text: '#1F2937',
      textLight: '#6B7280',
      background: '#FFFFFF',
      headerBg: '#EFF6FF',
    },
    layout: 'single',
    headerStyle: 'banner',
    sectionStyle: 'underline',
  },
  classic: {
    name: 'Classic',
    description: 'Traditional and timeless design',
    colors: {
      primary: '#374151',
      secondary: '#4B5563',
      accent: '#6B7280',
      text: '#111827',
      textLight: '#6B7280',
      background: '#FFFFFF',
      headerBg: '#F9FAFB',
    },
    layout: 'single',
    headerStyle: 'centered',
    sectionStyle: 'underline',
  },
  minimal: {
    name: 'Minimal',
    description: 'Simple and elegant with focus on content',
    colors: {
      primary: '#0F172A',
      secondary: '#334155',
      accent: '#64748B',
      text: '#0F172A',
      textLight: '#64748B',
      background: '#FFFFFF',
      headerBg: '#FFFFFF',
    },
    layout: 'single',
    headerStyle: 'left',
    sectionStyle: 'minimal',
  },
  creative: {
    name: 'Creative',
    description: 'Bold and eye-catching for creative roles',
    colors: {
      primary: '#7C3AED',
      secondary: '#8B5CF6',
      accent: '#A78BFA',
      text: '#1F2937',
      textLight: '#6B7280',
      background: '#FFFFFF',
      headerBg: '#F5F3FF',
    },
    layout: 'two-column',
    headerStyle: 'banner',
    sectionStyle: 'box',
  },
  executive: {
    name: 'Executive',
    description: 'Sophisticated design for senior positions',
    colors: {
      primary: '#0D9488',
      secondary: '#14B8A6',
      accent: '#2DD4BF',
      text: '#1F2937',
      textLight: '#6B7280',
      background: '#FFFFFF',
      headerBg: '#F0FDFA',
    },
    layout: 'sidebar',
    headerStyle: 'left',
    sectionStyle: 'icon',
  },
};

export const SECTION_ICONS: Record<string, string> = {
  personal: 'person-outline',
  experience: 'briefcase-outline',
  education: 'school-outline',
  skills: 'construct-outline',
  certifications: 'ribbon-outline',
  languages: 'language-outline',
  projects: 'folder-outline',
  references: 'people-outline',
  achievements: 'trophy-outline',
  volunteer: 'heart-outline',
};
