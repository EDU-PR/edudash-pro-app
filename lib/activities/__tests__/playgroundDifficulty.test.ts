import { getActivityById } from '@/lib/activities/preschoolActivities.data';
import { buildPlaygroundVariant } from '@/lib/activities/playgroundDifficulty';

describe('buildPlaygroundVariant', () => {
  const baseActivity = getActivityById('emoji_farm_count');

  it('builds easy variant with max 4 rounds and max 3 options per round', () => {
    expect(baseActivity).toBeTruthy();
    const easy = buildPlaygroundVariant(baseActivity!, 'easy');

    expect(easy.difficulty).toBe('easy');
    expect(easy.rounds.length).toBeLessThanOrEqual(4);

    easy.rounds.forEach((round) => {
      if (round.options && !round.confirmOnly) {
        expect(round.options.length).toBeLessThanOrEqual(3);
        expect(round.minWrongForHint).toBe(1);
      }
    });
  });

  it('keeps medium variant shape unchanged', () => {
    expect(baseActivity).toBeTruthy();
    const medium = buildPlaygroundVariant(baseActivity!, 'medium');

    expect(medium.difficulty).toBe('medium');
    expect(medium.rounds.length).toBe(baseActivity!.rounds.length);
    expect(medium).not.toBe(baseActivity);
  });

  it('builds tricky variant with 4 options and delayed hints', () => {
    expect(baseActivity).toBeTruthy();
    const tricky = buildPlaygroundVariant(baseActivity!, 'tricky');

    expect(tricky.difficulty).toBe('tricky');

    tricky.rounds.forEach((round) => {
      if (round.options && !round.confirmOnly) {
        expect(round.options.length).toBe(4);
        expect(round.minWrongForHint).toBe(2);
      }
    });
  });
});
