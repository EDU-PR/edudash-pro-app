import { CAPSQueryAdapter } from '@/services/modules/tools/CAPSTools';

type QueryResult = { data?: any; error?: any };

function createQueryBuilder(results: {
  textSearch: QueryResult;
  ilike: QueryResult;
  broad: QueryResult;
}) {
  const builder: any = {};
  builder.ilike = jest.fn().mockReturnValue(builder);
  builder.textSearch = jest.fn().mockImplementation(() => ({
    limit: jest.fn().mockResolvedValue(results.textSearch),
  }));
  builder.or = jest.fn().mockImplementation(() => ({
    limit: jest.fn().mockResolvedValue(results.ilike),
  }));
  builder.limit = jest.fn().mockResolvedValue(results.broad);
  return builder;
}

function createSupabaseMock(input: {
  rpcResult?: QueryResult;
  rpcError?: Error;
  queryResults?: {
    textSearch: QueryResult;
    ilike: QueryResult;
    broad: QueryResult;
  };
}) {
  const builder = createQueryBuilder(
    input.queryResults || {
      textSearch: { data: [], error: null },
      ilike: { data: [], error: null },
      broad: { data: [], error: null },
    }
  );

  const rpc = input.rpcError
    ? jest.fn().mockRejectedValue(input.rpcError)
    : jest.fn().mockResolvedValue(input.rpcResult || { data: [], error: null });

  return {
    rpc,
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue(builder),
    }),
  };
}

describe('CAPSQueryAdapter', () => {
  it('prefers RPC results when available', async () => {
    const supabase = createSupabaseMock({
      rpcResult: {
        data: [{ id: 'caps-1', title: 'Phonics Baseline', subject: 'Home Language' }],
        error: null,
      },
    });
    const adapter = new CAPSQueryAdapter(supabase as any);

    const result = await adapter.search({ query: 'phonics', grade: 'Grade R' });

    expect(result.source).toBe('rpc.search_caps_curriculum');
    expect(result.fatal).toBe(false);
    expect(result.outcome.status).toBe('success');
    expect(result.rows).toHaveLength(1);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('falls back to caps_documents when RPC fails', async () => {
    const supabase = createSupabaseMock({
      rpcResult: {
        data: null,
        error: { message: 'relation "public.caps_curriculum" does not exist', code: '42P01' },
      },
      queryResults: {
        textSearch: {
          data: [{ id: 'doc-1', title: 'Foundation phase phonics', subject: 'Home Language' }],
          error: null,
        },
        ilike: { data: [], error: null },
        broad: { data: [], error: null },
      },
    });
    const adapter = new CAPSQueryAdapter(supabase as any);

    const result = await adapter.search({ query: 'phonics' });

    expect(result.source).toBe('table.caps_documents');
    expect(result.fatal).toBe(false);
    expect(result.outcome.status).toBe('degraded');
    expect(result.outcome.source).toBe('caps_documents_fallback');
    expect(result.rows).toHaveLength(1);
  });

  it('returns degraded non-throw result when RPC and fallback both fail', async () => {
    const supabase = createSupabaseMock({
      rpcError: new Error('caps_rpc_timeout'),
      queryResults: {
        textSearch: { data: null, error: { message: 'text search failed', code: 'XX000' } },
        ilike: { data: null, error: { message: 'ilike failed', code: 'XX001' } },
        broad: { data: null, error: { message: 'broad query failed', code: 'XX002' } },
      },
    });
    const adapter = new CAPSQueryAdapter(supabase as any);

    const result = await adapter.search({ query: 'term plan' });

    expect(result.fatal).toBe(true);
    expect(result.source).toBe('degraded');
    expect(result.outcome.status).toBe('degraded');
    expect(result.outcome.source).toBe('caps_runtime');
    expect(result.rows).toEqual([]);
  });
});
