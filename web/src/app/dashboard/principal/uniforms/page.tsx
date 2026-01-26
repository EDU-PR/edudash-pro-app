'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import { Download, RefreshCw, Search, Shirt } from 'lucide-react';

interface UniformRow {
  id: string;
  child_name: string;
  age_years: number;
  tshirt_size: string;
  created_at: string;
  student_id: string;
  student?: {
    first_name?: string | null;
    last_name?: string | null;
    student_id?: string | null;
  } | null;
  parent?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
}

interface DisplayRow {
  id: string;
  childName: string;
  ageYears: number;
  tshirtSize: string;
  studentCode: string;
  parentName: string;
  parentEmail: string;
  submittedAt: string;
}

const SIZE_OPTIONS = [
  '2-3',
  '3-4',
  '4-5',
  '5-6',
  '6-7',
  '7-8',
  '8-9',
  '9-10',
  '10-11',
  '11-12',
  '12-13',
  'XS',
  'S',
  'M',
  'L',
  'XL',
];

const csvEscape = (value: string | number | null | undefined) => {
  const stringValue = value === null || value === undefined ? '' : String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/\"/g, '""')}"`;
  }
  return stringValue;
};

export default function UniformsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [rows, setRows] = useState<UniformRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);

  const { profile } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);
  const preschoolName = profile?.preschoolName;
  const preschoolId = profile?.preschoolId;

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        return;
      }
      setUserId(session.user.id);
    };
    initAuth();
  }, [router, supabase]);

  const loadUniforms = async () => {
    if (!preschoolId) return;
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('uniform_requests')
      .select('id, child_name, age_years, tshirt_size, created_at, student_id, student:students!uniform_requests_student_id_fkey(first_name,last_name,student_id), parent:profiles!uniform_requests_parent_id_fkey(first_name,last_name,email)')
      .eq('preschool_id', preschoolId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError('Unable to load uniform submissions.');
      setLoading(false);
      return;
    }

    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!preschoolId) return;
    loadUniforms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preschoolId]);

  const displayRows = useMemo<DisplayRow[]>(() => {
    return rows.map((row) => {
      const childName = row.child_name || `${row.student?.first_name || ''} ${row.student?.last_name || ''}`.trim();
      const parentName = `${row.parent?.first_name || ''} ${row.parent?.last_name || ''}`.trim();
      return {
        id: row.id,
        childName: childName || 'Unnamed Child',
        ageYears: row.age_years,
        tshirtSize: row.tshirt_size,
        studentCode: row.student?.student_id || '',
        parentName: parentName || row.parent?.email || '',
        parentEmail: row.parent?.email || '',
        submittedAt: row.created_at,
      };
    });
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return displayRows.filter((row) => {
      const matchesSearch = !term || [
        row.childName,
        row.studentCode,
        row.parentName,
        row.parentEmail,
      ].some((field) => field.toLowerCase().includes(term));
      const matchesSize = sizeFilter === 'all' || row.tshirtSize === sizeFilter;
      return matchesSearch && matchesSize;
    });
  }, [displayRows, searchTerm, sizeFilter]);

  const exportCsv = (data: DisplayRow[]) => {
    if (!data.length) return;
    const headers = ['Child Name', 'Age', 'T-shirt Size', 'Student Code', 'Parent Name', 'Parent Email', 'Submitted'];
    const csvRows = data.map((row) => [
      csvEscape(row.childName),
      csvEscape(row.ageYears),
      csvEscape(row.tshirtSize),
      csvEscape(row.studentCode),
      csvEscape(row.parentName),
      csvEscape(row.parentEmail),
      csvEscape(new Date(row.submittedAt).toLocaleDateString('en-ZA')),
    ]);

    const csv = [headers, ...csvRows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `uniform-sizes-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={preschoolId} hideRightSidebar={true}>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-slate-400">Loading uniform submissions...</p>
        </div>
      </PrincipalShell>
    );
  }

  return (
    <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={preschoolId} hideRightSidebar={true}>
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 className="h1" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Shirt size={22} /> Uniform Sizes
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              Collect T-shirt sizes for uniform printing. Shorts use the same size.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btnSecondary" onClick={loadUniforms}>
              <RefreshCw size={16} /> Refresh
            </button>
            <button className="btn btnPrimary" onClick={() => exportCsv(filteredRows)} disabled={!filteredRows.length}>
              <Download size={16} /> Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                type="text"
                className="input"
                placeholder="Search child, parent, or student code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: 40 }}
              />
            </div>
            <div>
              <select
                className="input"
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
              >
                <option value="all">All sizes</option>
                {SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="card" style={{ marginBottom: 16, color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {filteredRows.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <Shirt size={48} style={{ margin: '0 auto 16px', color: 'var(--muted)' }} />
            <h3 style={{ marginBottom: 8 }}>No uniform submissions yet</h3>
            <p style={{ color: 'var(--muted)' }}>
              Parents will appear here once they submit sizes.
            </p>
          </div>
        ) : (
          <div className="card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Child</th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Age</th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Size</th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Student Code</th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Parent</th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 600 }}>{row.childName}</div>
                      </td>
                      <td style={{ padding: 12 }}>{row.ageYears}</td>
                      <td style={{ padding: 12 }}>{row.tshirtSize}</td>
                      <td style={{ padding: 12 }}>{row.studentCode || '-'}</td>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 500 }}>{row.parentName || '-'}</div>
                        {row.parentEmail && (
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{row.parentEmail}</div>
                        )}
                      </td>
                      <td style={{ padding: 12, color: 'var(--muted)', fontSize: 13 }}>
                        {new Date(row.submittedAt).toLocaleDateString('en-ZA')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PrincipalShell>
  );
}
