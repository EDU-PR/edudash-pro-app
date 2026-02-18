import { unifiedToolRegistry } from '@/services/tools/UnifiedToolRegistry';

describe('UnifiedToolRegistry generate_chart access', () => {
  it('allows parent and student roles at starter tier', () => {
    const parentTools = unifiedToolRegistry.list('parent', 'starter').map((tool) => tool.name);
    const studentTools = unifiedToolRegistry.list('student', 'starter').map((tool) => tool.name);

    expect(parentTools).toContain('generate_chart');
    expect(studentTools).toContain('generate_chart');
  });

  it('keeps free tier blocked for generate_chart', () => {
    const freeParentTools = unifiedToolRegistry.list('parent', 'free').map((tool) => tool.name);
    expect(freeParentTools).not.toContain('generate_chart');
  });
});
