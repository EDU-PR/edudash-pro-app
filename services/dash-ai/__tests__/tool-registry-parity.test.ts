import { getDashToolShortcutsForRole } from '@/lib/ai/toolCatalog';
import { ToolRegistry } from '@/services/AgentTools';
import { unifiedToolRegistry } from '@/services/tools/UnifiedToolRegistry';

describe('Unified tool registry parity', () => {
  it('keeps UI shortcuts aligned with client tool definitions (teacher/starter)', () => {
    const role = 'teacher';
    const tier = 'starter';

    const shortcuts = getDashToolShortcutsForRole(role).filter((tool) =>
      ToolRegistry.hasTool(tool.name)
    );

    const clientDefs = unifiedToolRegistry.toClientToolDefs(role, tier);
    const clientNames = new Set(clientDefs.map((def) => def.name));

    expect(shortcuts.length).toBeGreaterThan(0);

    shortcuts.forEach((shortcut) => {
      expect(clientNames.has(shortcut.name)).toBe(true);

      const shortcutSchema = ToolRegistry.getTool(shortcut.name)?.parameters;
      const clientSchema = clientDefs.find((def) => def.name === shortcut.name)
        ?.input_schema;

      expect(clientSchema).toEqual(shortcutSchema);
    });
  });

  it('executes pending client tool calls through the same canonical registry deterministically', async () => {
    const context = {
      userId: 'teacher-1',
      role: 'teacher',
      tier: 'starter',
      organizationId: 'org-1',
      hasOrganization: true,
      isGuest: false,
    };

    const first = await unifiedToolRegistry.execute(
      'open_document',
      { url: 'https://example.com' },
      context
    );

    const second = await unifiedToolRegistry.execute(
      'open_document',
      { url: 'https://example.com' },
      context
    );

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(first.result).toEqual(second.result);
    expect((first.result as any)?.action).toBe('opened_url');
  });
});
