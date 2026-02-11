import fs from 'fs';
import path from 'path';

describe('syncPendingTuitionFees guardrails', () => {
  const sourcePath = path.resolve(__dirname, '../student-fees/useStudentFeeActions.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');

  it('only updates fees when tuition resolution is matched', () => {
    expect(source).toContain("if (resolution.status !== 'matched' || !resolution.fee)");
    expect(source).toContain("resolutionStatus: resolution.status");
    expect(source).toContain("resolutionReason: resolution.reason");
  });

  it('surfaces unresolved states instead of silently defaulting first fee', () => {
    expect(source).toContain('setTuitionSyncIssue({');
    expect(source).toContain('describeTuitionResolution');
    expect(source).toContain("status: 'ambiguous'");
    expect(source).toContain("status: 'unmatched'");
  });
});
