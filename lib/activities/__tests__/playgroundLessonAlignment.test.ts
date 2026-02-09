import {
  getPreferredPlaygroundDomains,
  getRecommendedPlaygroundActivityIds,
  sortPlaygroundActivitiesForLesson,
} from '@/lib/activities/playgroundLessonAlignment';
import { PRESCHOOL_ACTIVITIES } from '@/lib/activities/preschoolActivities.data';

describe('playgroundLessonAlignment', () => {
  it('prefers numeracy activities for counting lessons', () => {
    const recommended = getRecommendedPlaygroundActivityIds({
      title: 'Counting Farm Animals',
      subject: 'Mathematics',
      description: 'Learners practice number recognition and counting',
    });

    expect(recommended.length).toBeGreaterThan(0);
    expect(recommended).toContain('emoji_farm_count');
  });

  it('returns default domains when no keywords match', () => {
    const preferred = getPreferredPlaygroundDomains({
      title: 'General revision',
      subject: 'Unspecified',
      description: '',
    });

    expect(preferred[0]).toBe('numeracy');
  });

  it('sorts recommended activities first', () => {
    const sorted = sortPlaygroundActivitiesForLesson({
      title: 'Farm counting patterns',
      subject: 'Math',
      description: 'Count and identify number patterns',
    }, PRESCHOOL_ACTIVITIES);

    const firstFive = sorted.slice(0, 5).map((activity) => activity.id);
    expect(firstFive).toContain('emoji_farm_count');
  });
});
