import fs from 'fs';
import path from 'path';

describe('principal student edit field mapping', () => {
  const editSourcePath = path.resolve(__dirname, '../../web/src/app/dashboard/principal/students/[id]/edit/page.tsx');
  const detailSourcePath = path.resolve(__dirname, '../../web/src/app/dashboard/principal/students/[id]/page.tsx');
  const editSource = fs.readFileSync(editSourcePath, 'utf8');
  const detailSource = fs.readFileSync(detailSourcePath, 'utf8');

  it('uses medical_conditions for edit payload instead of medical_info', () => {
    expect(editSource).toContain('medical_conditions: formData.medical_conditions || null');
    expect(editSource).not.toContain('medical_info: formData.medical_info || null');
  });

  it('supports inline quick edit on detail page', () => {
    expect(detailSource).toContain('Quick Edit (on this page)');
    expect(detailSource).toContain('handleQuickEditSave');
    expect(detailSource).toContain('organization_id.eq.${tenantId}');
  });
});
