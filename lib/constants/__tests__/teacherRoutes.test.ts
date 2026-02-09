import { getTeacherRouteForSchoolType } from '@/lib/constants/teacherRoutes';

describe('teacherRoutes school-type routing', () => {
  it('routes create lesson to preschool generator for preschool orgs', () => {
    expect(getTeacherRouteForSchoolType('create_lesson', 'preschool')).toBe('/screens/preschool-lesson-generator');
  });

  it('routes create lesson to generic AI generator for k12 orgs', () => {
    expect(getTeacherRouteForSchoolType('create_lesson', 'k12_school')).toBe('/screens/ai-lesson-generator');
  });

  it('keeps quick lesson on preschool generator and avoids it for k12', () => {
    expect(getTeacherRouteForSchoolType('quick_lesson', 'preschool')).toBe('/screens/preschool-lesson-generator?mode=quick');
    expect(getTeacherRouteForSchoolType('quick_lesson', 'k12_school')).toBe('/screens/ai-lesson-generator');
  });
});
