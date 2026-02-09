import { getActivityById } from '@/lib/activities/preschoolActivities.data';

describe('preschoolActivities.data', () => {
  it('includes animals in emoji_farm_count round r6', () => {
    const activity = getActivityById('emoji_farm_count');
    expect(activity).toBeTruthy();

    const round6 = activity?.rounds.find((round) => round.id === 'r6');
    expect(round6).toBeTruthy();
    expect(round6?.confirmOnly).toBe(true);
    expect(round6?.emojiGrid?.length).toBeGreaterThan(0);
  });
});
