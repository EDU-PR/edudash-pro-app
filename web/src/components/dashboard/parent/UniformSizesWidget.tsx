'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ChildCard } from '@/lib/hooks/parent/types';
import { CheckCircle2, Shirt, AlertCircle } from 'lucide-react';

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

type EntryStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UniformEntry {
  childName: string;
  ageYears: string;
  tshirtSize: string;
  status: EntryStatus;
  message?: string | null;
  updatedAt?: string | null;
}

interface UniformSizesWidgetProps {
  childrenCards: ChildCard[];
}

const getAgeYears = (dateOfBirth?: string): string => {
  if (!dateOfBirth) return '';
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return '';
  const age = Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  return age > 0 ? String(age) : '';
};

export function UniformSizesWidget({ childrenCards }: UniformSizesWidgetProps) {
  const supabase = createClient();
  const [entries, setEntries] = useState<Record<string, UniformEntry>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const childIds = useMemo(() => childrenCards.map((c) => c.id), [childrenCards]);

  useEffect(() => {
    if (!childrenCards.length) {
      setEntries({});
      setLoading(false);
      return;
    }

    const defaults: Record<string, UniformEntry> = {};
    childrenCards.forEach((child) => {
      const name = `${child.firstName} ${child.lastName}`.trim();
      defaults[child.id] = {
        childName: name,
        ageYears: getAgeYears(child.dateOfBirth),
        tshirtSize: '',
        status: 'idle',
        message: null,
        updatedAt: null,
      };
    });

    setEntries((prev) => {
      const merged: Record<string, UniformEntry> = { ...defaults };
      Object.entries(prev).forEach(([id, entry]) => {
        merged[id] = { ...merged[id], ...entry };
      });
      return merged;
    });
  }, [childrenCards]);

  useEffect(() => {
    const loadExisting = async () => {
      if (!childIds.length) return;
      setLoading(true);
      setLoadError(null);

      const { data, error } = await supabase
        .from('uniform_requests')
        .select('student_id, child_name, age_years, tshirt_size, updated_at')
        .in('student_id', childIds);

      if (error) {
        setLoadError('Unable to load existing uniform sizes.');
        setLoading(false);
        return;
      }

      if (data) {
        setEntries((prev) => {
          const next = { ...prev };
          data.forEach((row: any) => {
            next[row.student_id] = {
              ...(next[row.student_id] || {}),
              childName: row.child_name || next[row.student_id]?.childName || '',
              ageYears: row.age_years ? String(row.age_years) : next[row.student_id]?.ageYears || '',
              tshirtSize: row.tshirt_size || next[row.student_id]?.tshirtSize || '',
              status: 'saved',
              message: 'Saved',
              updatedAt: row.updated_at || null,
            };
          });
          return next;
        });
      }

      setLoading(false);
    };

    loadExisting();
  }, [childIds, supabase]);

  const updateEntry = (childId: string, patch: Partial<UniformEntry>) => {
    setEntries((prev) => ({
      ...prev,
      [childId]: { ...prev[childId], ...patch, status: 'idle', message: null },
    }));
  };

  const saveEntry = async (childId: string) => {
    const entry = entries[childId];
    if (!entry) return;

    const childName = entry.childName.trim();
    const ageValue = parseInt(entry.ageYears, 10);

    if (!childName) {
      updateEntry(childId, { status: 'error', message: 'Please enter the child name.' });
      return;
    }
    if (!entry.tshirtSize) {
      updateEntry(childId, { status: 'error', message: 'Select a T-shirt size.' });
      return;
    }
    if (!Number.isFinite(ageValue) || ageValue < 1 || ageValue > 18) {
      updateEntry(childId, { status: 'error', message: 'Enter a valid age (1-18).' });
      return;
    }

    setEntries((prev) => ({
      ...prev,
      [childId]: { ...prev[childId], status: 'saving', message: null },
    }));

    const { data, error } = await supabase
      .from('uniform_requests')
      .upsert(
        {
          student_id: childId,
          child_name: childName,
          age_years: ageValue,
          tshirt_size: entry.tshirtSize,
        },
        { onConflict: 'student_id' }
      )
      .select('updated_at')
      .single();

    if (error) {
      setEntries((prev) => ({
        ...prev,
        [childId]: { ...prev[childId], status: 'error', message: error.message || 'Save failed' },
      }));
      return;
    }

    setEntries((prev) => ({
      ...prev,
      [childId]: {
        ...prev[childId],
        status: 'saved',
        message: 'Saved',
        updatedAt: data?.updated_at || new Date().toISOString(),
      },
    }));
  };

  if (!childrenCards.length) {
    return (
      <div className="card">
        <div className="sectionTitle">Uniform Sizes</div>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Add a child first to submit uniform sizes.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Shirt size={18} style={{ color: 'var(--primary)' }} />
        <div className="sectionTitle" style={{ margin: 0 }}>Uniform Sizes</div>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        Please confirm each child&apos;s T-shirt size and age. The same size will be used for shorts.
      </p>

      {loading && (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading existing submissions...</p>
      )}
      {loadError && (
        <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>
          {loadError}
        </div>
      )}

      <div className="grid gap-4">
        {childrenCards.map((child) => {
          const entry = entries[child.id];
          if (!entry) return null;

          return (
            <div key={child.id} className="card" style={{ padding: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>
                {child.firstName} {child.lastName}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="text-xs" style={{ color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                    Child Name
                  </label>
                  <input
                    className="input"
                    value={entry.childName}
                    onChange={(e) => updateEntry(child.id, { childName: e.target.value })}
                    placeholder="Child name"
                  />
                </div>
                <div>
                  <label className="text-xs" style={{ color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                    Age (years)
                  </label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={18}
                    value={entry.ageYears}
                    onChange={(e) => updateEntry(child.id, { ageYears: e.target.value })}
                    placeholder="Age"
                  />
                </div>
                <div>
                  <label className="text-xs" style={{ color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                    T-shirt Size
                  </label>
                  <select
                    className="input"
                    value={entry.tshirtSize}
                    onChange={(e) => updateEntry(child.id, { tshirtSize: e.target.value })}
                  >
                    <option value="">Select size</option>
                    {SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    className="btn btnPrimary"
                    onClick={() => saveEntry(child.id)}
                    disabled={entry.status === 'saving'}
                    type="button"
                  >
                    {entry.status === 'saving' ? 'Saving…' : 'Save'}
                  </button>
                  {entry.status === 'saved' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontSize: 12 }}>
                      <CheckCircle2 size={14} /> Saved
                    </span>
                  )}
                  {entry.status === 'error' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--danger)', fontSize: 12 }}>
                      <AlertCircle size={14} /> {entry.message}
                    </span>
                  )}
                </div>
              </div>
              {entry.updatedAt && entry.status !== 'saving' && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
                  Last updated: {new Date(entry.updatedAt).toLocaleString('en-ZA')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
