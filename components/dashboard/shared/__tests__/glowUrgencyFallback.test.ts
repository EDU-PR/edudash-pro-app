import fs from 'fs';
import path from 'path';

describe('GlowContainer urgency fallback guard', () => {
  it('keeps safe fallback lookup for unknown urgency values', () => {
    const filePath = path.resolve(__dirname, '../GlowContainer.tsx');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).toContain('const glowColors = GLOW_COLORS[urgency] || GLOW_COLORS.none;');
    expect(source).toContain('const borderColors = BORDER_COLORS[urgency] || BORDER_COLORS.none;');
  });
});
