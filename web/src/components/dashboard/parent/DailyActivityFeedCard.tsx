"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Activity, BookOpen, Calculator, FlaskConical, Music, Palette, Salad, Sun } from "lucide-react";

interface DailyActivityRow {
  id: string;
  activity_name: string;
  description: string | null;
  activity_date: string;
  start_time: string | null;
  end_time: string | null;
  materials_needed: string[] | null;
  learning_objectives: string[] | null;
  notes: string | null;
  created_by: string;
  profiles?: { first_name: string | null; last_name: string | null } | null;
}

interface DailyActivity {
  id: string;
  name: string;
  description: string | null;
  time: string | null;
  teacherName: string;
  materials: string[];
  objectives: string[];
  notes: string | null;
}

interface DailyActivityFeedCardProps {
  classId?: string | null;
  date?: Date;
  maxItems?: number;
  showHeader?: boolean;
}

const isMissingSchema = (error?: PostgrestError | null) => {
  if (!error) return false;
  return error.code === "42P01" || error.code === "42703";
};

const iconForActivity = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes("art") || lower.includes("paint") || lower.includes("craft")) return Palette;
  if (lower.includes("music") || lower.includes("song")) return Music;
  if (lower.includes("story") || lower.includes("read") || lower.includes("book")) return BookOpen;
  if (lower.includes("math") || lower.includes("count")) return Calculator;
  if (lower.includes("science") || lower.includes("experiment") || lower.includes("nature")) return FlaskConical;
  if (lower.includes("lunch") || lower.includes("snack") || lower.includes("meal")) return Salad;
  if (lower.includes("outdoor") || lower.includes("play") || lower.includes("game")) return Sun;
  return Activity;
};

const formatTime = (timeString: string | null) => {
  if (!timeString) return null;
  const date = new Date(`1970-01-01T${timeString}`);
  if (Number.isNaN(date.getTime())) return timeString;
  return date.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
};

export function DailyActivityFeedCard({
  classId,
  date = new Date(),
  maxItems = 8,
  showHeader = true,
}: DailyActivityFeedCardProps) {
  const supabase = useMemo(() => createClient(), []);
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const dateString = useMemo(() => date.toISOString().split("T")[0], [date]);

  const loadActivities = useCallback(async () => {
    if (!classId) {
      setActivities([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("daily_activities")
      .select(
        "id, activity_name, description, activity_date, start_time, end_time, materials_needed, learning_objectives, notes, created_by, profiles:created_by(first_name, last_name)"
      )
      .eq("class_id", classId)
      .eq("activity_date", dateString)
      .order("start_time", { ascending: true, nullsFirst: false })
      .limit(maxItems);

    if (error) {
      if (!isMissingSchema(error)) {
        setActivities([]);
      }
      setLoading(false);
      return;
    }

    const rows = (data || []) as DailyActivityRow[];
    const mapped = rows.map((row) => ({
      id: row.id,
      name: row.activity_name,
      description: row.description,
      time: row.start_time ? `${formatTime(row.start_time)}${row.end_time ? ` - ${formatTime(row.end_time)}` : ""}` : null,
      teacherName: row.profiles
        ? `${row.profiles.first_name || ""} ${row.profiles.last_name || ""}`.trim() || "Teacher"
        : "Teacher",
      materials: row.materials_needed || [],
      objectives: row.learning_objectives || [],
      notes: row.notes || null,
    }));

    setActivities(mapped);
    setLoading(false);
  }, [classId, dateString, maxItems, supabase]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  useEffect(() => {
    if (!classId) return;
    const channel = supabase
      .channel(`daily-activities-${classId}-${dateString}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_activities", filter: `class_id=eq.${classId}` },
        () => {
          void loadActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId, dateString, loadActivities, supabase]);

  if (loading) {
    return (
      <div className="card">
        <div className="sectionTitle">Today&apos;s Activities</div>
        <div className="muted">Loading activities...</div>
      </div>
    );
  }

  if (activities.length === 0) {
    return null;
  }

  return (
    <div className="card">
      {showHeader && <div className="sectionTitle">Today&apos;s Activities</div>}
      <div style={{ display: "grid", gap: 12 }}>
        {activities.map((activity) => {
          const Icon = iconForActivity(activity.name);
          const isExpanded = expandedId === activity.id;
          return (
            <div key={activity.id} className="card" style={{ padding: 12, border: "1px solid var(--border)" }}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : activity.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    background: "var(--surface-2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <Icon size={16} style={{ color: "var(--primary)" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{activity.name}</div>
                    {activity.time && <div style={{ fontSize: 12, color: "var(--muted)" }}>{activity.time}</div>}
                  </div>
                </div>
                {activity.description && (
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>
                    {isExpanded ? activity.description : `${activity.description.slice(0, 120)}${activity.description.length > 120 ? "…" : ""}`}
                  </div>
                )}
              </button>

              {isExpanded && (
                <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                  <div>Teacher: {activity.teacherName}</div>
                  {activity.materials.length > 0 && (
                    <div>Materials: {activity.materials.join(", ")}</div>
                  )}
                  {activity.objectives.length > 0 && (
                    <div>Objectives: {activity.objectives.join(", ")}</div>
                  )}
                  {activity.notes && <div>Notes: {activity.notes}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
