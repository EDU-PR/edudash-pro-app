import fs from 'fs';
import path from 'path';

describe('K12ParentChildCard avatar rendering contract', () => {
  it('renders avatar image when avatarUrl is present with initials fallback', () => {
    const cardPath = path.resolve(__dirname, '../components/K12ParentChildCard.tsx');
    const source = fs.readFileSync(cardPath, 'utf8');

    expect(source).toContain('avatarUrl?: string | null;');
    expect(source).toContain('{child.avatarUrl ? (');
    expect(source).toContain('<Image source={{ uri: child.avatarUrl }} style={styles.childAvatarImage} />');
    expect(source).toContain('<Text style={styles.childAvatarText}>{child.avatar}</Text>');
  });
});
