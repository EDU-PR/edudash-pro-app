'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import { Calendar, Plus, Pencil, Trash2, X } from 'lucide-react';

interface TimetableSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string | null;
  activity_type: string;
  room: string | null;
  notes?: string | null;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const normalizeTime = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  // PostgREST time expects HH:MM[:SS]
  return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
};

const timeToMinutes = (value: string) => {
  const [hh, mm] = value.split(':');
  return (Number(hh) || 0) * 60 + (Number(mm) || 0);
};

export default function TimetablePage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() || 1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    start_time: string;
    end_time: string;
    subject: string;
    activity_type: string;
    room: string;
    notes: string;
  }>({
    start_time: '08:00',
    end_time: '09:00',
    subject: '',
    activity_type: 'lesson',
    room: '',
    notes: '',
  });

  const { profile } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);
  const preschoolId = profile?.preschoolId || profile?.organizationId;

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/sign-in'); return; }
      setUserId(session.user.id);
    };
    init();
  }, [router, supabase]);

  useEffect(() => {
    if (!preschoolId) return;
    const load = async () => {
      const { data } = await supabase
        .from('timetable_slots')
        .select('*')
        .eq('school_id', preschoolId)
        .order('start_time');
      setSlots((data as TimetableSlot[]) || []);
      setLoading(false);
    };
    load();
  }, [preschoolId, supabase]);

  const daySlots = slots.filter((s) => s.day_of_week === selectedDay);

  const openCreate = () => {
    setEditingSlot(null);
    setFormError(null);
    const last = daySlots[daySlots.length - 1];
    const suggestedStart = last?.end_time?.slice(0, 5) || '08:00';
    const suggestedEndMinutes = timeToMinutes(suggestedStart) + 60;
    const endH = String(Math.floor(suggestedEndMinutes / 60)).padStart(2, '0');
    const endM = String(suggestedEndMinutes % 60).padStart(2, '0');
    setForm({
      start_time: suggestedStart,
      end_time: `${endH}:${endM}`,
      subject: '',
      activity_type: 'lesson',
      room: '',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEdit = (slot: TimetableSlot) => {
    setEditingSlot(slot);
    setFormError(null);
    setForm({
      start_time: slot.start_time?.slice(0, 5) || '08:00',
      end_time: slot.end_time?.slice(0, 5) || '09:00',
      subject: slot.subject || '',
      activity_type: slot.activity_type || 'lesson',
      room: slot.room || '',
      notes: slot.notes || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingSlot(null);
    setFormError(null);
  };

  const saveSlot = async () => {
    if (!preschoolId || !userId) return;
    setFormError(null);

    const startRaw = normalizeTime(form.start_time);
    const endRaw = normalizeTime(form.end_time);
    if (!startRaw || !endRaw) {
      setFormError('Start and end time are required.');
      return;
    }

    const startMin = timeToMinutes(startRaw);
    const endMin = timeToMinutes(endRaw);
    if (endMin <= startMin) {
      setFormError('End time must be after start time.');
      return;
    }

    // Fast local overlap check (UI feedback)
    const overlapsLocal = daySlots
      .filter((s) => (editingSlot ? s.id !== editingSlot.id : true))
      .some((s) => {
        const sStart = timeToMinutes(normalizeTime(s.start_time));
        const sEnd = timeToMinutes(normalizeTime(s.end_time));
        return startMin < sEnd && endMin > sStart;
      });
    if (overlapsLocal) {
      setFormError('This slot overlaps an existing slot for the selected day.');
      return;
    }

    setSaving(true);
    try {
      // Server-side overlap check (race-safe)
      let overlapQuery = supabase
        .from('timetable_slots')
        .select('id')
        .eq('school_id', preschoolId)
        .eq('day_of_week', selectedDay)
        .lt('start_time', endRaw)
        .gt('end_time', startRaw)
        .limit(1);
      if (editingSlot) {
        overlapQuery = overlapQuery.neq('id', editingSlot.id);
      }
      const { data: overlaps, error: overlapError } = await overlapQuery;
      if (overlapError) throw overlapError;
      if (overlaps && overlaps.length > 0) {
        setFormError('This slot overlaps an existing slot (server validation).');
        return;
      }

      const payload = {
        day_of_week: selectedDay,
        start_time: startRaw,
        end_time: endRaw,
        subject: form.subject.trim() || null,
        activity_type: form.activity_type.trim() || 'lesson',
        room: form.room.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (editingSlot) {
        const { data: updated, error } = await supabase
          .from('timetable_slots')
          .update(payload)
          .eq('id', editingSlot.id)
          .select('*')
          .single();
        if (error) throw error;
        setSlots((prev) =>
          prev
            .map((s) => (s.id === editingSlot.id ? (updated as TimetableSlot) : s))
            .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
        );
      } else {
        const { data: inserted, error } = await supabase
          .from('timetable_slots')
          .insert({
            school_id: preschoolId,
            created_by: userId,
            ...payload,
          })
          .select('*')
          .single();
        if (error) throw error;
        setSlots((prev) =>
          [...prev, inserted as TimetableSlot].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
        );
      }

      setModalOpen(false);
      setEditingSlot(null);
    } catch (err: any) {
      console.error('[TimetablePage] Failed to save slot:', err);
      setFormError(err?.message || 'Failed to save slot.');
    } finally {
      setSaving(false);
    }
  };

  const deleteSlot = async (slot: TimetableSlot) => {
    if (!confirm('Delete this timetable slot?')) return;
    try {
      const { error } = await supabase.from('timetable_slots').delete().eq('id', slot.id);
      if (error) throw error;
      setSlots((prev) => prev.filter((s) => s.id !== slot.id));
    } catch (err: any) {
      console.error('[TimetablePage] Failed to delete slot:', err);
      alert(err?.message || 'Failed to delete slot.');
    }
  };

  return (
    <PrincipalShell tenantSlug={tenantSlug} userEmail={profile?.email} userName={profile?.firstName} preschoolName={profile?.preschoolName}>
      <div style={{ padding: 'var(--space-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h1 className="h1">Timetable Management</h1>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>Manage weekly class schedules</p>
          </div>
          <button
            className="qa"
            onClick={openCreate}
            style={{ background: 'var(--primary)', color: 'white', border: 'none', gap: 6 }}
          >
            <Plus size={16} /> Add Slot
          </button>
        </div>

        {/* Day Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map((day) => (
            <button
              key={day}
              className="qa"
              onClick={() => setSelectedDay(day)}
              style={{
                background: selectedDay === day ? 'var(--primary)' : undefined,
                color: selectedDay === day ? 'white' : undefined,
                border: selectedDay === day ? 'none' : undefined,
              }}
            >
              <Calendar size={14} /> {DAYS[day]}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading...</p>
        ) : daySlots.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <Calendar size={40} color="var(--muted)" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 600 }}>No classes scheduled for {DAYS[selectedDay]}</p>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>Add a timetable slot to get started</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {daySlots.map((slot) => (
              <div key={slot.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 14 }}>
                <div style={{ minWidth: 80, textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 14 }}>{slot.start_time?.slice(0, 5)}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>–</div>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 14 }}>{slot.end_time?.slice(0, 5)}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{slot.subject || slot.activity_type}</div>
                  {slot.room && <div style={{ fontSize: 13, color: 'var(--muted)' }}>📍 {slot.room}</div>}
                  {slot.notes && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{slot.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="iconBtn" onClick={() => openEdit(slot)} title="Edit">
                    <Pencil size={16} />
                  </button>
                  <button className="iconBtn" onClick={() => deleteSlot(slot)} title="Delete" style={{ color: '#ef4444' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {modalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <div className="card" style={{ width: '100%', maxWidth: 560, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18 }}>{editingSlot ? 'Edit Slot' : 'Add Slot'}</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--muted)' }}>
                    {DAYS[selectedDay]}
                  </p>
                </div>
                <button className="iconBtn" onClick={closeModal} aria-label="Close">
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                    Start time
                    <input
                      className="input"
                      type="time"
                      value={form.start_time}
                      onChange={(e) => setForm((prev) => ({ ...prev, start_time: e.target.value }))}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                    End time
                    <input
                      className="input"
                      type="time"
                      value={form.end_time}
                      onChange={(e) => setForm((prev) => ({ ...prev, end_time: e.target.value }))}
                    />
                  </label>
                </div>

                <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                  Activity type
                  <select
                    className="input"
                    value={form.activity_type}
                    onChange={(e) => setForm((prev) => ({ ...prev, activity_type: e.target.value }))}
                  >
                    <option value="lesson">Lesson</option>
                    <option value="break">Break</option>
                    <option value="activity">Activity</option>
                    <option value="outdoor">Outdoor</option>
                    <option value="meal">Meal</option>
                    <option value="nap">Nap</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                  Subject (optional)
                  <input
                    className="input"
                    value={form.subject}
                    onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                    placeholder="e.g., Literacy, Numeracy"
                  />
                </label>

                <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                  Room (optional)
                  <input
                    className="input"
                    value={form.room}
                    onChange={(e) => setForm((prev) => ({ ...prev, room: e.target.value }))}
                    placeholder="e.g., Room 2"
                  />
                </label>

                <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                  Notes (optional)
                  <textarea
                    className="input"
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any extra details..."
                  />
                </label>

                {formError && (
                  <div className="card" style={{ padding: 10, border: '1px solid rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.08)' }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#fecaca' }}>{formError}</p>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                  <button className="btn btnSecondary" onClick={closeModal} disabled={saving}>
                    Cancel
                  </button>
                  <button className="btn btnPrimary" onClick={saveSlot} disabled={saving}>
                    {saving ? 'Saving...' : editingSlot ? 'Save Changes' : 'Create Slot'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PrincipalShell>
  );
}
