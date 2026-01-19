// 🔐 Registration Steps - Export all step components
// Each step is a separate component for WARP.md compliance (≤400 lines per component)

export { PersonalInfoStep } from './PersonalInfoStep';
export { OrganizationSelectionStep } from './OrganizationSelectionStep';
export { SecuritySetupStep } from './SecuritySetupStep';

// Re-export constants used across steps
export const GRADE_LEVELS = [
  'Pre-K', 'Kindergarten',
  '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade',
  '6th Grade', '7th Grade', '8th Grade',
  '9th Grade', '10th Grade', '11th Grade', '12th Grade',
  'College/University'
];

export const SUBJECTS = [
  'Mathematics', 'Science', 'English', 'History', 'Geography',
  'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Art',
  'Music', 'Physical Education', 'Foreign Language', 'Social Studies'
];
