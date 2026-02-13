'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import { Calendar, Clock, Plus } from 'lucide-react';

interface TimetableSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string | null;
  activity_type: string;
  room: string | null;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TimetablePage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() || 1);

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

  return (
    <PrincipalShell tenantSlug={tenantSlug} userEmail={profile?.email} userName={profile?.firstName} preschoolName={profile?.preschoolName}>
      <div style={{ padding: 'var(--space-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h1 className="h1">Timetable Management</h1>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>Manage weekly class schedules</p>
          </div>
          <button className="qa" style={{ background: 'var(--primary)', color: 'white', border: 'none', gap: 6 }}>
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PrincipalShell>
  );
}
