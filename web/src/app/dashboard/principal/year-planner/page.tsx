'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import { Calendar, Plus, Edit, Trash2, CheckCircle, XCircle, BookOpen, X } from 'lucide-react';

interface AcademicTerm {
  id: string;
  name: string;
  academic_year: number;
  term_number: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_published: boolean;
  description?: string;
}

export default function YearPlannerPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTerm, setEditingTerm] = useState<AcademicTerm | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    academic_year: new Date().getFullYear(),
    term_number: 1,
    start_date: '',
    end_date: '',
    description: '',
    is_active: false,
    is_published: false,
  });

  const { profile } = useUserProfile(userId);
  const preschoolId = profile?.preschoolId;

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        return;
      }
      setUserId(session.user.id);
      setLoading(false);
    };
    initAuth();
  }, [router, supabase]);

  useEffect(() => {
    if (preschoolId) {
      loadTerms();
    }
  }, [preschoolId]);

  const loadTerms = async () => {
    if (!preschoolId) return;
    
    try {
      const { data, error } = await supabase
        .from('academic_terms')
        .select('*')
        .eq('preschool_id', preschoolId)
        .order('academic_year', { ascending: false })
        .order('term_number', { ascending: true });

      if (error) throw error;
      setTerms(data || []);
    } catch (err) {
      console.error('Error loading terms:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preschoolId || !userId) return;

    try {
      const payload = {
        preschool_id: preschoolId,
        created_by: userId,
        ...formData,
        start_date: formData.start_date,
        end_date: formData.end_date,
      };

      if (editingTerm) {
        const { error } = await supabase
          .from('academic_terms')
          .update(payload)
          .eq('id', editingTerm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('academic_terms')
          .insert(payload);
        if (error) throw error;
      }

      await loadTerms();
      setShowCreateModal(false);
      setEditingTerm(null);
      setFormData({
        name: '',
        academic_year: new Date().getFullYear(),
        term_number: 1,
        start_date: '',
        end_date: '',
        description: '',
        is_active: false,
        is_published: false,
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this term?')) return;
    
    try {
      const { error } = await supabase
        .from('academic_terms')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await loadTerms();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleTogglePublish = async (term: AcademicTerm) => {
    try {
      const { error } = await supabase
        .from('academic_terms')
        .update({ is_published: !term.is_published })
        .eq('id', term.id);
      if (error) throw error;
      await loadTerms();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleEdit = (term: AcademicTerm) => {
    setEditingTerm(term);
    setFormData({
      name: term.name,
      academic_year: term.academic_year,
      term_number: term.term_number,
      start_date: term.start_date,
      end_date: term.end_date,
      description: term.description || '',
      is_active: term.is_active,
      is_published: term.is_published,
    });
    setShowCreateModal(true);
  };

  const groupedTerms = terms.reduce((acc, term) => {
    const year = term.academic_year;
    if (!acc[year]) acc[year] = [];
    acc[year].push(term);
    return acc;
  }, {} as Record<number, AcademicTerm[]>);

  if (loading) {
    return (
      <PrincipalShell>
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <p>Loading...</p>
        </div>
      </PrincipalShell>
    );
  }

  return (
    <PrincipalShell>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 className="h1">Year Planner</h1>
            <p className="text-muted">Plan and publish your academic calendar</p>
          </div>
          <button
            className="btn btnPrimary"
            onClick={() => {
              setEditingTerm(null);
              setFormData({
                name: '',
                academic_year: new Date().getFullYear(),
                term_number: 1,
                start_date: '',
                end_date: '',
                description: '',
                is_active: false,
                is_published: false,
              });
              setShowCreateModal(true);
            }}
          >
            <Plus size={18} /> New Term
          </button>
        </div>

        {Object.keys(groupedTerms).length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <Calendar size={48} style={{ color: 'var(--muted)', marginBottom: 16 }} />
            <h3 style={{ marginBottom: 8 }}>No Terms Planned</h3>
            <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
              Start by creating your first academic term
            </p>
            <button className="btn btnPrimary" onClick={() => setShowCreateModal(true)}>
              <Plus size={18} /> Create First Term
            </button>
          </div>
        ) : (
          Object.entries(groupedTerms)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([year, yearTerms]) => (
              <div key={year} className="card" style={{ marginBottom: 24 }}>
                <h2 style={{ marginBottom: 16, fontSize: 24, fontWeight: 600 }}>
                  Academic Year {year}
                </h2>
                <div style={{ display: 'grid', gap: 16 }}>
                  {yearTerms.map((term) => (
                    <div
                      key={term.id}
                      className="card"
                      style={{
                        padding: 20,
                        border: term.is_active ? '2px solid var(--primary)' : '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                          <h3 style={{ margin: 0, fontSize: 18 }}>{term.name}</h3>
                          {term.is_active && (
                            <span className="badge" style={{ background: 'var(--primary)', color: 'white' }}>
                              Active
                            </span>
                          )}
                          {term.is_published && (
                            <span className="badge" style={{ background: '#10b981', color: 'white' }}>
                              Published
                            </span>
                          )}
                        </div>
                        <p style={{ color: 'var(--muted)', margin: '4px 0' }}>
                          {new Date(term.start_date).toLocaleDateString()} - {new Date(term.end_date).toLocaleDateString()}
                        </p>
                        {term.description && (
                          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>
                            {term.description}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="iconBtn"
                          onClick={() => handleTogglePublish(term)}
                          title={term.is_published ? 'Unpublish' : 'Publish'}
                        >
                          {term.is_published ? <CheckCircle size={18} /> : <XCircle size={18} />}
                        </button>
                        <button className="iconBtn" onClick={() => handleEdit(term)} title="Edit">
                          <Edit size={18} />
                        </button>
                        <button className="iconBtn" onClick={() => handleDelete(term.id)} title="Delete">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
        )}

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.8)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div className="card" style={{ maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ margin: 0 }}>
                  {editingTerm ? 'Edit Term' : 'Create New Term'}
                </h2>
                <button className="iconBtn" onClick={() => setShowCreateModal(false)}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gap: 16 }}>
                  <div>
                    <label className="label">Term Name</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Term 1, First Semester"
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label className="label">Academic Year</label>
                      <input
                        type="number"
                        className="input"
                        value={formData.academic_year}
                        onChange={(e) => setFormData({ ...formData, academic_year: Number(e.target.value) })}
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Term Number</label>
                      <select
                        className="input"
                        value={formData.term_number}
                        onChange={(e) => setFormData({ ...formData, term_number: Number(e.target.value) })}
                        required
                      >
                        <option value={1}>Term 1</option>
                        <option value={2}>Term 2</option>
                        <option value={3}>Term 3</option>
                        <option value={4}>Term 4</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label className="label">Start Date</label>
                      <input
                        type="date"
                        className="input"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="label">End Date</label>
                      <input
                        type="date"
                        className="input"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Description (Optional)</label>
                    <textarea
                      className="input"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      placeholder="Add any notes about this term..."
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      />
                      <span>Set as Active Term</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={formData.is_published}
                        onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                      />
                      <span>Publish to Teachers</span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btnSecondary"
                      onClick={() => setShowCreateModal(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btnPrimary">
                      {editingTerm ? 'Update Term' : 'Create Term'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PrincipalShell>
  );
}
