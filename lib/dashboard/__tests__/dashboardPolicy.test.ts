import {
  filterActionsByDashboardPolicy,
  isDashboardActionAllowed,
} from '@/lib/dashboard/dashboardPolicy';

describe('dashboardPolicy', () => {
  it('blocks K-12 exam actions from default preschool parent flow', () => {
    expect(isDashboardActionAllowed('parent', 'preschool', 'my_exams')).toBe(false);
    expect(isDashboardActionAllowed('parent', 'preschool', 'view_grades')).toBe(false);
    expect(isDashboardActionAllowed('parent', 'preschool', 'learning_hub')).toBe(true);
  });

  it('blocks quick lesson for k12 teachers and allows create lesson', () => {
    expect(isDashboardActionAllowed('teacher', 'k12_school', 'quick_lesson')).toBe(false);
    expect(isDashboardActionAllowed('teacher', 'k12_school', 'create_lesson')).toBe(true);
    expect(isDashboardActionAllowed('teacher', 'k12_school', 'request_petty_cash')).toBe(true);
  });

  it('filters principal actions using the school-type policy map', () => {
    const actions = [
      { id: 'create-lesson', title: 'Create Lesson' },
      { id: 'curriculum-themes', title: 'Curriculum Themes' },
      { id: 'settings', title: 'Settings' },
    ];
    const filtered = filterActionsByDashboardPolicy(actions, 'principal_admin', 'preschool');
    expect(filtered.map((item) => item.id)).toEqual(['create-lesson', 'curriculum-themes', 'settings']);
  });
});
