import { estimateVisemeTimelinePhonics } from '../visemeEstimator';

describe('estimateVisemeTimelinePhonics', () => {
  it('holds /m/ viseme long enough and inserts a following silence marker', () => {
    const timeline = estimateVisemeTimelinePhonics('Say /m/');

    const mIndex = timeline.findIndex((evt) => evt.visemeId === 20);
    expect(mIndex).toBeGreaterThanOrEqual(0);
    expect(timeline[mIndex].durationMs).toBeGreaterThanOrEqual(200);

    const silenceAfterM = timeline.slice(mIndex + 1).find((evt) => evt.visemeId === 21);
    expect(silenceAfterM).toBeDefined();
    expect((silenceAfterM?.durationMs ?? 0)).toBeGreaterThanOrEqual(150);
  });

  it('maps /s/ and /n/ to sustained phonics visemes', () => {
    const timeline = estimateVisemeTimelinePhonics('Now say /s/ then /n/ slowly.');

    const hasS = timeline.some((evt) => evt.visemeId === 14 && evt.durationMs >= 200);
    const hasN = timeline.some((evt) => evt.visemeId === 15 && evt.durationMs >= 200);

    expect(hasS).toBe(true);
    expect(hasN).toBe(true);
  });
});
