import { planToolCall } from '../toolPlanner';

describe('toolPlanner deterministic overrides', () => {
  it('routes explicit PDF intent to export_pdf without planner round-trip', async () => {
    const invoke = jest.fn().mockResolvedValue({ data: null, error: null });
    const supabaseClient = { functions: { invoke } };

    const result = await planToolCall({
      supabaseClient,
      role: 'principal_admin',
      message: 'Please generate a PDF for Grade 4 multiplication practice.',
      tools: [
        { name: 'export_pdf', description: 'Export PDF' },
        { name: 'get_assignments', description: 'Get assignments' },
      ],
    });

    expect(result?.tool).toBe('export_pdf');
    expect(result?.reason).toBe('deterministic_pdf_intent');
    expect(result?.parameters?.title).toEqual(expect.any(String));
    expect(String(result?.parameters?.content || '')).toContain('Grade 4 multiplication practice');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('routes CAPS search intent to search_caps_curriculum without planner round-trip', async () => {
    const invoke = jest.fn().mockResolvedValue({ data: null, error: null });
    const supabaseClient = { functions: { invoke } };

    const result = await planToolCall({
      supabaseClient,
      role: 'principal_admin',
      message: 'Search South African CAPS curriculum guidance for Grade 4 multiplication.',
      tools: [
        { name: 'search_caps_curriculum', description: 'Search CAPS curriculum' },
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        tool: 'search_caps_curriculum',
        reason: 'deterministic_caps_search_intent',
      })
    );
    expect(result?.parameters?.query).toContain('CAPS curriculum guidance');
    expect(invoke).not.toHaveBeenCalled();
  });
});
