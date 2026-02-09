import fs from 'fs';
import path from 'path';
import { sanitizeAvatarUrl } from '@/lib/utils/avatar';

describe('useK12ParentData avatar mapping', () => {
  it('sanitizes avatar urls safely', () => {
    expect(sanitizeAvatarUrl('https://cdn.example.com/avatar.png')).toBe('https://cdn.example.com/avatar.png');
    expect(sanitizeAvatarUrl('  undefined  ')).toBeNull();
    expect(sanitizeAvatarUrl('')).toBeNull();
  });

  it('maps student avatar_url into child avatarUrl', () => {
    const hookPath = path.resolve(__dirname, '../hooks/useK12ParentData.ts');
    const source = fs.readFileSync(hookPath, 'utf8');

    expect(source).toContain('avatarUrl: sanitizeAvatarUrl(student.avatar_url ?? null)');
  });
});
