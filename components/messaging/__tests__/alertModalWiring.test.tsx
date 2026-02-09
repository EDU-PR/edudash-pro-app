import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../..');

const files = [
  'components/messaging/MessageComposer.tsx',
  'components/messaging/MessageAttachmentBar.tsx',
  'components/messaging/ImageViewer.tsx',
  'components/account/SettingsModal.tsx',
  'components/account/OrganizationSwitcher.tsx',
];

describe('parent alert modal wiring', () => {
  it('does not use native Alert.alert in parent messaging/account components', () => {
    for (const relativePath of files) {
      const absolutePath = path.join(ROOT, relativePath);
      const source = fs.readFileSync(absolutePath, 'utf8');
      expect(source).not.toContain('Alert.alert(');
    }
  });

  it('wires modal alert callback props', () => {
    const composer = fs.readFileSync(path.join(ROOT, 'components/messaging/MessageComposer.tsx'), 'utf8');
    const settingsModal = fs.readFileSync(path.join(ROOT, 'components/account/SettingsModal.tsx'), 'utf8');

    expect(composer).toContain('showAlert?: ParentAlertApi');
    expect(settingsModal).toContain('showAlert?: ParentAlertApi');
  });
});
