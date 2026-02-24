const mockInvoke = jest.fn();

const createMockQueryChain = () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
  };
  return chain;
};

jest.mock('@/lib/supabase', () => ({
  assertSupabase: () => ({
    from: jest.fn(() => createMockQueryChain()),
    functions: {
      invoke: mockInvoke,
    },
  }),
}));

import { WeeklyProgramCopilotService, type GenerateWeeklyProgramFromTermInput } from '../weeklyProgramCopilotService';

const baseInput: GenerateWeeklyProgramFromTermInput = {
  preschoolId: 'school-1',
  createdBy: 'user-1',
  weekStartDate: '2026-02-18',
  theme: 'Healthy Habits',
  ageGroup: '3-6',
};

describe('WeeklyProgramCopilotService', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('parses weekday-keyed map responses without requiring explicit days[]', async () => {
    mockInvoke.mockResolvedValueOnce({
      error: null,
      data: {
        content: JSON.stringify({
          title: 'Healthy Habits',
          summary: 'A simple weekly flow',
          monday: [
            {
              title: 'Arrival & Welcome',
              block_type: 'transition',
              start: '07:30',
              end: '08:00',
            },
          ],
          tuesday: [
            {
              name: 'Outdoor Play',
              type: 'outdoor',
              startTime: '09:00',
              endTime: '09:30',
            },
          ],
        }),
      },
    });

    const draft = await WeeklyProgramCopilotService.generateWeeklyProgramFromTerm(baseInput);
    const arrival = draft.blocks.find((block) => block.title === 'Arrival & Welcome');
    const outdoorOnTuesday = draft.blocks.find(
      (block) => block.title === 'Outdoor Play' && block.day_of_week === 2,
    );
    const mondayWeather = draft.blocks.find((block) => block.day_of_week === 1 && /weather/i.test(block.title));
    const tuesdayWeather = draft.blocks.find((block) => block.day_of_week === 2 && /weather/i.test(block.title));

    expect(arrival?.day_of_week).toBe(1);
    expect(outdoorOnTuesday?.day_of_week).toBe(2);
    expect(outdoorOnTuesday?.block_type).toBe('outdoor');
    expect(mondayWeather).toBeTruthy();
    expect(tuesdayWeather).toBeTruthy();
  });

  it('parses nested wrappers and day objects that use activities[]', async () => {
    mockInvoke.mockResolvedValueOnce({
      error: null,
      data: JSON.stringify({
        result: {
          weeklyProgram: {
            title: 'Theme Week',
            days: {
              Wednesday: {
                activities: [
                  {
                    activity: 'Story Circle',
                    category: 'circle_time',
                    time_start: '10:00',
                    time_end: '10:20',
                    parentTip: 'Read together tonight',
                  },
                ],
              },
            },
          },
        },
      }),
    });

    const draft = await WeeklyProgramCopilotService.generateWeeklyProgramFromTerm(baseInput);
    const story = draft.blocks.find((block) => block.title === 'Story Circle' && block.day_of_week === 3);
    const weather = draft.blocks.find((block) => block.day_of_week === 3 && /weather/i.test(block.title));

    expect(story?.day_of_week).toBe(3);
    expect(story?.block_type).toBe('circle_time');
    expect(story?.start_time).toBe('10:00');
    expect(story?.end_time).toBe('10:20');
    expect(story?.parent_tip).toBe('Read together tonight');
    expect(weather).toBeTruthy();
  });

  it('accepts top-level activities[] as flat blocks', async () => {
    mockInvoke.mockResolvedValueOnce({
      error: null,
      data: {
        content: JSON.stringify({
          title: 'Creative Friday',
          activities: [
            {
              day: 'Friday',
              activity: 'Music & Movement',
              activity_type: 'movement',
              goals: ['Rhythm', 'Coordination'],
            },
          ],
        }),
      },
    });

    const draft = await WeeklyProgramCopilotService.generateWeeklyProgramFromTerm(baseInput);
    const movement = draft.blocks.find((block) => block.title === 'Music & Movement' && block.day_of_week === 5);
    const weather = draft.blocks.find((block) => block.day_of_week === 5 && /weather/i.test(block.title));

    expect(movement?.day_of_week).toBe(5);
    expect(movement?.objectives).toEqual(expect.arrayContaining(['Rhythm', 'Coordination']));
    expect(weather).toBeTruthy();
  });

  it('uses lesson_generation for repair fallback and recovers malformed output', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        error: null,
        data: {
          content: '{"title":"Broken JSON","days":[{"day_of_week":1,"blocks":[{"title":"Arrival"}]}',
        },
      })
      .mockResolvedValueOnce({
        error: null,
        data: {
          content: JSON.stringify({
            title: 'Recovered Weekly Program',
            days: [
              {
                day_of_week: 1,
                blocks: [
                  {
                    block_order: 1,
                    block_type: 'transition',
                    title: 'Arrival',
                    start_time: '07:30',
                    end_time: '08:00',
                    objectives: [],
                    materials: [],
                    transition_cue: null,
                    notes: null,
                    parent_tip: null,
                  },
                ],
              },
            ],
          }),
        },
      });

    const draft = await WeeklyProgramCopilotService.generateWeeklyProgramFromTerm(baseInput);
    const arrival = draft.blocks.find((block) => block.title === 'Arrival');
    const weather = draft.blocks.find((block) => block.day_of_week === 1 && /weather/i.test(block.title));

    expect(arrival).toBeTruthy();
    expect(weather).toBeTruthy();
    expect(mockInvoke).toHaveBeenCalled();
    if (mockInvoke.mock.calls.length > 1) {
      expect(mockInvoke.mock.calls[1][1]?.body?.service_type).toBe('lesson_generation');
    }
  });

  it('backfills omitted weekdays with a full day structure', async () => {
    mockInvoke.mockResolvedValueOnce({
      error: null,
      data: {
        content: JSON.stringify({
          title: 'Incomplete Week',
          summary: 'Thursday omitted by model',
          days: {
            monday: [{ title: 'Arrival Routine', block_type: 'transition' }],
            tuesday: [{ title: 'Math Warmup', block_type: 'learning' }],
            wednesday: [{ title: 'Story Circle', block_type: 'circle_time' }],
            friday: [{ title: 'Music Movement', block_type: 'movement' }],
          },
        }),
      },
    });

    const draft = await WeeklyProgramCopilotService.generateWeeklyProgramFromTerm(baseInput);
    const thursdayBlocks = draft.blocks.filter((block) => block.day_of_week === 4);

    for (const day of [1, 2, 3, 4, 5]) {
      const dayBlocks = draft.blocks.filter((block) => block.day_of_week === day);
      expect(dayBlocks.length).toBeGreaterThanOrEqual(6);
      expect(dayBlocks.length).toBeLessThanOrEqual(10);
    }

    expect(thursdayBlocks.length).toBeGreaterThanOrEqual(6);
    expect(
      thursdayBlocks.some((block) =>
        String(block.notes || '').toLowerCase().includes('auto'),
      ),
    ).toBe(true);
  });

  it('guarantees six-to-ten blocks per weekday even when AI output is heavily truncated', async () => {
    mockInvoke.mockResolvedValueOnce({
      error: null,
      data: {
        content: JSON.stringify({
          title: 'Truncated Week',
          summary: 'Only one day came back from the model',
          days: [
            {
              day_of_week: 1,
              blocks: [{ block_order: 1, title: 'Arrival', block_type: 'transition' }],
            },
          ],
        }),
      },
    });

    const draft = await WeeklyProgramCopilotService.generateWeeklyProgramFromTerm(baseInput);

    for (const day of [1, 2, 3, 4, 5]) {
      const dayBlocks = draft.blocks.filter((block) => block.day_of_week === day);
      expect(dayBlocks.length).toBeGreaterThanOrEqual(6);
      expect(dayBlocks.length).toBeLessThanOrEqual(10);
    }
  });

  it('guarantees every weekday runs until at least 13:30', async () => {
    mockInvoke.mockResolvedValueOnce({
      error: null,
      data: {
        content: JSON.stringify({
          title: 'Short Day Response',
          summary: 'Model ended too early',
          days: [
            {
              day_of_week: 1,
              blocks: [
                { block_order: 1, title: 'Arrival', block_type: 'transition', start_time: '06:30', end_time: '07:00' },
                { block_order: 2, title: 'Math Game', block_type: 'learning', start_time: '07:00', end_time: '08:00' },
              ],
            },
          ],
        }),
      },
    });

    const draft = await WeeklyProgramCopilotService.generateWeeklyProgramFromTerm(baseInput);

    for (const day of [1, 2, 3, 4, 5]) {
      const dayBlocks = draft.blocks.filter((block) => block.day_of_week === day);
      expect(dayBlocks.length).toBeGreaterThan(0);

      const latestEnd = dayBlocks.reduce((max, block) => {
        const end = String(block.end_time || '');
        if (!/^\d{2}:\d{2}$/.test(end)) return max;
        const [h, m] = end.split(':').map(Number);
        const mins = (h * 60) + m;
        return Math.max(max, mins);
      }, -1);

      expect(latestEnd).toBeGreaterThanOrEqual((13 * 60) + 30);
    }
  });

  it('returns a full fallback week when AI returns no blocks', async () => {
    mockInvoke.mockResolvedValueOnce({
      error: null,
      data: {
        content: JSON.stringify({
          title: 'Empty Payload',
          summary: 'No usable blocks',
          days: [],
        }),
      },
    });

    const draft = await WeeklyProgramCopilotService.generateWeeklyProgramFromTerm(baseInput);

    for (const day of [1, 2, 3, 4, 5]) {
      const dayBlocks = draft.blocks.filter((block) => block.day_of_week === day);
      expect(dayBlocks.length).toBeGreaterThanOrEqual(6);
      const latestEnd = dayBlocks.reduce((max, block) => {
        const end = String(block.end_time || '');
        if (!/^\d{2}:\d{2}$/.test(end)) return max;
        const [h, m] = end.split(':').map(Number);
        return Math.max(max, (h * 60) + m);
      }, -1);
      expect(latestEnd).toBeGreaterThanOrEqual((13 * 60) + 30);
    }
  });

  it('enforces weather repetition across Monday-Friday blocks', async () => {
    mockInvoke.mockResolvedValueOnce({
      error: null,
      data: {
        content: JSON.stringify({
          title: 'Healthy Habits',
          summary: 'Repetition-focused routine',
          days: [
            {
              day_of_week: 1,
              blocks: [
                { block_order: 1, title: 'Weather Circle', block_type: 'circle_time' },
                { block_order: 2, title: 'Phonics', block_type: 'learning' },
              ],
            },
            {
              day_of_week: 2,
              blocks: [{ block_order: 1, title: 'Math Warmup', block_type: 'learning' }],
            },
            {
              day_of_week: 3,
              blocks: [{ block_order: 1, title: 'Story Circle', block_type: 'circle_time' }],
            },
            {
              day_of_week: 4,
              blocks: [{ block_order: 1, title: 'Outdoor Play', block_type: 'outdoor' }],
            },
            {
              day_of_week: 5,
              blocks: [{ block_order: 1, title: 'Art & Movement', block_type: 'movement' }],
            },
          ],
        }),
      },
    });

    const draft = await WeeklyProgramCopilotService.generateWeeklyProgramFromTerm(baseInput);
    const weatherSignals = ['weather', 'forecast', 'season', 'temperature', 'climate', 'sunny', 'rain', 'cloud'];

    for (const day of [1, 2, 3, 4, 5]) {
      const dayBlocks = draft.blocks.filter((block) => block.day_of_week === day);
      expect(dayBlocks.length).toBeGreaterThan(0);
      const hasWeather = dayBlocks.some((block) => {
        const haystack = `${block.title || ''} ${block.block_type || ''} ${block.notes || ''} ${block.transition_cue || ''}`.toLowerCase();
        return weatherSignals.some((keyword) => haystack.includes(keyword));
      });
      expect(hasWeather).toBe(true);
    }
  });
});
