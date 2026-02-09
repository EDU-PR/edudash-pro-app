import { HiringHubService } from '../HiringHubService';
import { assertSupabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  assertSupabase: jest.fn(),
}));

type QueryResponse = {
  data: any;
  error: any;
};

function buildSupabaseMock(responses: Record<string, QueryResponse[]>) {
  const counters: Record<string, number> = {};

  const nextResponse = (table: string): QueryResponse => {
    const idx = counters[table] || 0;
    counters[table] = idx + 1;
    return responses[table]?.[idx] || { data: null, error: null };
  };

  const makeBuilder = (table: string) => {
    const builder: any = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      in: jest.fn(() => builder),
      order: jest.fn(() => builder),
      limit: jest.fn(() => builder),
      maybeSingle: jest.fn(async () => nextResponse(table)),
      single: jest.fn(async () => nextResponse(table)),
      then: (onFulfilled: any, onRejected: any) =>
        Promise.resolve(nextResponse(table)).then(onFulfilled, onRejected),
    };
    return builder;
  };

  return {
    from: jest.fn((table: string) => makeBuilder(table)),
    storage: {
      from: jest.fn(() => ({
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://example.com/resume.pdf' } })),
      })),
    },
    functions: {
      invoke: jest.fn(async () => ({ data: null, error: null })),
    },
  };
}

describe('HiringHubService regressions', () => {
  const mockAssertSupabase = assertSupabase as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns school applications from primary join query', async () => {
    const supabaseMock = buildSupabaseMock({
      job_applications: [
        {
          data: [
            {
              id: 'app-1',
              candidate_profile_id: 'cand-1',
              applied_at: '2026-02-08T08:00:00.000Z',
              status: 'new',
              resume_file_path: 'resume.pdf',
              candidate_profile: {
                first_name: 'Jane',
                last_name: 'Doe',
                email: 'jane@example.com',
                phone: '+27123456789',
                experience_years: 4,
              },
              job_posting: {
                title: 'Preschool Teacher',
              },
            },
          ],
          error: null,
        },
      ],
    });

    mockAssertSupabase.mockReturnValue(supabaseMock);

    const result = await HiringHubService.getApplicationsForSchool('school-1');

    expect(result).toHaveLength(1);
    expect(result[0].candidate_name).toBe('Jane Doe');
    expect(result[0].candidate_email).toBe('jane@example.com');
    expect(result[0].job_title).toBe('Preschool Teacher');
    expect(result[0].has_resume).toBe(true);
  });

  it('falls back when users-table permission error appears', async () => {
    const supabaseMock = buildSupabaseMock({
      job_applications: [
        {
          data: null,
          error: {
            code: '42501',
            message: 'permission denied for table users',
          },
        },
        {
          data: [
            {
              id: 'app-2',
              candidate_profile_id: 'abc123def456',
              applied_at: '2026-02-08T08:00:00.000Z',
              status: 'new',
              resume_file_path: null,
              job_posting: {
                title: 'Assistant Teacher',
              },
            },
          ],
          error: null,
        },
      ],
    });

    mockAssertSupabase.mockReturnValue(supabaseMock);

    const result = await HiringHubService.getApplicationsForSchool('school-2');

    expect(result).toHaveLength(1);
    expect(result[0].candidate_name).toContain('Candidate');
    expect(result[0].candidate_email).toBe('');
    expect(result[0].job_title).toBe('Assistant Teacher');
  });

  it('propagates fallback query failure after users permission denial', async () => {
    const supabaseMock = buildSupabaseMock({
      job_applications: [
        {
          data: null,
          error: {
            code: '42501',
            message: 'permission denied for table users',
          },
        },
        {
          data: null,
          error: {
            code: 'XX000',
            message: 'fallback unavailable',
          },
        },
      ],
    });

    mockAssertSupabase.mockReturnValue(supabaseMock);

    await expect(
      HiringHubService.getApplicationsForSchool('school-3')
    ).rejects.toThrow('Failed to fetch applications: fallback unavailable');
  });

  it('uses getApplicationById fallback path when candidate join is blocked by users policy', async () => {
    const supabaseMock = buildSupabaseMock({
      job_applications: [
        {
          data: null,
          error: {
            code: '42501',
            message: 'permission denied for table users',
          },
        },
        {
          data: {
            id: 'app-3',
            candidate_profile_id: 'f1e2d3c4b5a6',
            applied_at: '2026-02-08T08:00:00.000Z',
            status: 'under_review',
            resume_file_path: null,
            job_posting: {
              title: 'Aftercare Teacher',
            },
          },
          error: null,
        },
      ],
    });

    mockAssertSupabase.mockReturnValue(supabaseMock);

    const result = await HiringHubService.getApplicationById('app-3');

    expect(result).not.toBeNull();
    expect(result.candidate_name).toContain('Candidate');
    expect(result.job_title).toBe('Aftercare Teacher');
    expect(result.applied_at).toBe('2026-02-08T08:00:00.000Z');
    expect(result.has_resume).toBe(false);
  });
});
