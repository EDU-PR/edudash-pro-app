import type { AIUsageRecord } from '../usage'

// Mock react-native Platform to avoid RN environment in Node tests
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }), { virtual: true })

// Mock supabase module to avoid actual network calls if accidentally invoked
// Mock using project alias (virtual) so modules importing '@/lib/supabase' succeed
// Create shared mocks so tests can control behavior
const mockFunctions = { invoke: jest.fn() }
const mockAuth = { getUser: jest.fn() }

jest.mock('@/lib/supabase', () => ({
  assertSupabase: () => ({
    functions: mockFunctions,
    auth: mockAuth,
  }),
}), { virtual: true })

// Also mock via relative path in case some tests import it directly
jest.mock('../../../lib/supabase', () => ({
  assertSupabase: () => ({
    functions: mockFunctions,
    auth: mockAuth,
  }),
}))

describe('getCombinedUsage (server-authoritative)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns server usage when available', async () => {
    const usage = await import('../usage')
    const serverCounts: AIUsageRecord = {
      lesson_generation: 10,
      grading_assistance: 5,
      homework_help: 2,
      homework_help_agentic: 0,
      transcription: 0,
    }

    // Mock the edge function response to return server counts
    mockFunctions.invoke.mockResolvedValueOnce({ data: { monthly: serverCounts }, error: null })

    const result = await usage.getCombinedUsage()

    expect(result).toEqual(serverCounts)
  })

  it('falls back to local usage (zeros) when server unavailable', async () => {
    const usage = await import('../usage')

    // Simulate server failure
    mockFunctions.invoke.mockRejectedValueOnce(new Error('network'))

    const result = await usage.getCombinedUsage()

    expect(result).toEqual({ lesson_generation: 0, grading_assistance: 0, homework_help: 0, homework_help_agentic: 0, transcription: 0 })
  })

  it('reads authoritative server totals after successful usage increment', async () => {
    const usage = await import('../usage')
    mockAuth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user_1' } } })
    mockFunctions.invoke
      .mockResolvedValueOnce({ data: {}, error: null }) // incrementUsage -> logUsageEvent
      .mockResolvedValueOnce({
        data: {
          monthly: {
            lesson_generation: 11,
            grading_assistance: 5,
            homework_help: 2,
            homework_help_agentic: 0,
            transcription: 0,
          },
        },
        error: null,
      }) // getCombinedUsage -> getServerUsage

    await usage.incrementUsage('lesson_generation', 1, 'claude-sonnet-4-20250514')
    const result = await usage.getCombinedUsage()

    expect(result.lesson_generation).toBe(11)
    expect(mockFunctions.invoke).toHaveBeenCalledWith(
      'ai-usage',
      expect.objectContaining({
        body: expect.objectContaining({ action: 'log' }),
      }),
    )
    expect(mockFunctions.invoke).toHaveBeenCalledWith(
      'ai-usage',
      expect.objectContaining({
        body: {},
      }),
    )
  })
})
