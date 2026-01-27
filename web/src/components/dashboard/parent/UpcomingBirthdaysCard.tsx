"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";
import { Cake, PartyPopper } from "lucide-react";

interface StudentRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  class_id: string | null;
  avatar_url: string | null;
}

interface UpcomingBirthday {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  daysUntil: number;
  ageTurning: number;
  avatarUrl?: string | null;
}

interface UpcomingBirthdaysCardProps {
  classId?: string | null;
  maxItems?: number;
  showHeader?: boolean;
}

const isMissingSchema = (error?: PostgrestError | null) => {
  if (!error) return false;
  return error.code === "42P01" || error.code === "42703";
};

const calculateUpcomingBirthday = (dob: string, today: Date) => {
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return null;

  const currentYear = today.getFullYear();
  const thisYearBirthday = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
  const nextBirthday = thisYearBirthday >= today
    ? thisYearBirthday
    : new Date(currentYear + 1, birthDate.getMonth(), birthDate.getDate());

  const daysUntil = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const ageTurning = nextBirthday.getFullYear() - birthDate.getFullYear();

  return { daysUntil, ageTurning };
};

export function UpcomingBirthdaysCard({
  classId,
  maxItems = 4,
  showHeader = true,
}: UpcomingBirthdaysCardProps) {
  const supabase = useMemo(() => createClient(), []);
  const [birthdays, setBirthdays] = useState<UpcomingBirthday[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBirthdays = useCallback(async () => {
    if (!classId) {
      setBirthdays([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("id, first_name, last_name, date_of_birth, class_id, avatar_url")
      .eq("class_id", classId)
      .eq("is_active", true);

    if (error) {
      if (!isMissingSchema(error)) {
        setBirthdays([]);
      }
      setLoading(false);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows = (data || []) as StudentRow[];
    const upcoming: UpcomingBirthday[] = rows
      .map((row) => {
        if (!row.date_of_birth) return null;
        const calc = calculateUpcomingBirthday(row.date_of_birth, today);
        if (!calc) return null;
        return {
          id: row.id,
          studentId: row.id,
          firstName: row.first_name || "Student",
          lastName: row.last_name || "",
          daysUntil: calc.daysUntil,
          ageTurning: calc.ageTurning,
          avatarUrl: row.avatar_url,
        };
      })
      .filter((row): row is UpcomingBirthday => Boolean(row))
      .filter((row) => row.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, maxItems);

    setBirthdays(upcoming);
    setLoading(false);
  }, [classId, maxItems, supabase]);

  useEffect(() => {
    void loadBirthdays();
  }, [loadBirthdays]);

  if (loading) {
    return (
      <div className="card">
        <div className="sectionTitle">Upcoming Birthdays</div>
        <div className="muted">Loading birthdays...</div>
      </div>
    );
  }

  if (birthdays.length === 0) {
    return null;
  }

  return (
    <div className="card">
      {showHeader && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <PartyPopper size={18} style={{ color: "var(--primary)" }} />
          <div className="sectionTitle" style={{ margin: 0 }}>Upcoming Birthdays</div>
        </div>
      )}
      <div style={{ display: "grid", gap: 10 }}>
        {birthdays.map((birthday) => (
          <div
            key={birthday.id}
            className="card"
            style={{ padding: 12, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "var(--surface-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
              }}
            >
              {birthday.firstName.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>
                {birthday.firstName} {birthday.lastName}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Turning {birthday.ageTurning}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--primary)", display: "flex", alignItems: "center", gap: 4 }}>
              <Cake size={14} />
              {birthday.daysUntil === 0 ? "Today" : `In ${birthday.daysUntil} days`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
