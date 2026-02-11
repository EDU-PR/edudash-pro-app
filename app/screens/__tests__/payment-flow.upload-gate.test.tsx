import fs from 'fs';
import path from 'path';

describe('payment-flow upload gate behavior', () => {
  const sourcePath = path.resolve(__dirname, '../payment-flow.tsx');
  const source = fs.readFileSync(sourcePath, 'utf8');

  it('uses launch state to compute upload button label and disable state', () => {
    expect(source).toContain("const uploadButtonLabel = launchState === 'idle' ? 'Complete Step 1 First' : 'Upload Proof of Payment'");
    expect(source).toContain('disabled={!canUploadProof}');
    expect(source).toContain('onPress={() => canUploadProof && setShowUploadModal(true)}');
    expect(source).toContain('{uploadButtonLabel}');
  });

  it('wires manual confirmation control to confirmManualPayment', () => {
    expect(source).toContain('confirmManualPayment');
    expect(source).toContain('onPress={confirmManualPayment}');
    expect(source).toContain('I Paid Manually');
    expect(source).toContain('Manual Payment Confirmed');
  });
});
