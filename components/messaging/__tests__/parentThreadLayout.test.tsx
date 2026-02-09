import { messageThreadStyles } from '@/lib/screen-styles/parent-message-thread.styles';

describe('parent thread layout styling', () => {
  it('keeps composer blended without hard top shadow seam', () => {
    expect((messageThreadStyles as any).composerArea.shadowOpacity).toBe(0);
    expect((messageThreadStyles as any).composerArea.elevation).toBe(0);
  });

  it('does not use clip margin bottom for composer spacing', () => {
    expect((messageThreadStyles as any).messagesClip.marginBottom).toBeUndefined();
  });
});
