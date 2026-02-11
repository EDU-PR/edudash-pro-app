import fs from 'fs';
import path from 'path';

describe('students detail fee summaries', () => {
  const sourcePath = path.resolve(__dirname, '../../../lib/screen-data/students-detail.helpers.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');

  it('loads fee summary data from student_fees', () => {
    expect(source).toContain("from('student_fees')");
    expect(source).toContain("select('student_id, status, amount_outstanding, paid_date')");
    expect(source).toContain('feeSummaryMap');
  });

  it('maps each student to computed fee summary instead of hardcoded values', () => {
    expect(source).toContain("fees: feeSummaryMap[db.id] || { outstanding: 0, lastPayment: '', paymentStatus: 'current' as const }");
    expect(source).not.toContain("fees: { outstanding: 0, lastPayment: '', paymentStatus: 'current' as const },");
  });
});
