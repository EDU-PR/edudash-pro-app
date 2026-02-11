import fs from 'fs';
import path from 'path';

describe('parent payments tuition display', () => {
  const sourcePath = path.resolve(__dirname, '../../web/src/app/dashboard/parent/payments/page.tsx');
  const source = fs.readFileSync(sourcePath, 'utf8');

  it('uses deterministic resolver instead of first tuition fallback', () => {
    expect(source).toContain('resolveTuitionFeeStructure');
    expect(source).toContain("if (resolution.status !== 'matched' || !resolution.fee)");
    expect(source).not.toContain('For now, show the first tuition fee');
    expect(source).not.toContain("schoolFees.find((f: { fee_category: string }) => ");
  });

  it('shows fee setup issue state when unresolved', () => {
    expect(source).toContain('feeSetupIssue');
    expect(source).toContain('Fee setup needs review');
  });
});
