'use client';

import { useMemo } from 'react';

interface CalendarViewProps {
  events: any[];
  currentDate: Date;
  onEventClick: (event: any) => void;
}

export function CalendarView({ events, currentDate, onEventClick }: CalendarViewProps) {
  const { days, firstDayOfWeek } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const firstDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days in month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return { days, firstDayOfWeek };
  }, [currentDate]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    events.forEach(event => {
      const dateKey = new Date(event.start_date).toISOString().split('T')[0];
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(event);
    });
    return grouped;
  }, [events]);

  const getEventColor = (type: string) => {
    const colors: Record<string, string> = {
      holiday: '#EF4444',
      parent_meeting: '#8B5CF6',
      field_trip: '#10B981',
      assembly: '#3B82F6',
      sports_day: '#F59E0B',
      graduation: '#EC4899',
      fundraiser: '#14B8A6',
      other: '#6B7280',
    };
    return colors[type] || colors.other;
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div className="card">
      {/* Weekday headers */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gap: 1,
        marginBottom: 1,
        backgroundColor: 'var(--divider)'
      }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div
            key={day}
            style={{
              padding: '12px 8px',
              textAlign: 'center',
              fontWeight: 600,
              fontSize: 14,
              color: 'var(--muted)',
              backgroundColor: 'var(--card)',
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gap: 1,
        backgroundColor: 'var(--divider)'
      }}>
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} style={{ backgroundColor: 'var(--card)', minHeight: 120 }} />;
          }

          const dateKey = date.toISOString().split('T')[0];
          const dayEvents = eventsByDate[dateKey] || [];
          const today = isToday(date);

          return (
            <div
              key={dateKey}
              style={{
                backgroundColor: 'var(--card)',
                padding: 8,
                minHeight: 120,
                position: 'relative',
                cursor: dayEvents.length > 0 ? 'pointer' : 'default',
              }}
            >
              {/* Date number */}
              <div
                style={{
                  fontSize: 14,
                  fontWeight: today ? 700 : 500,
                  color: today ? '#fff' : 'var(--text)',
                  backgroundColor: today ? 'var(--primary)' : 'transparent',
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 4,
                }}
              >
                {date.getDate()}
              </div>

              {/* Events */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {dayEvents.slice(0, 3).map((event) => (
                  <button
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    style={{
                      backgroundColor: getEventColor(event.event_type),
                      color: '#fff',
                      padding: '4px 6px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 500,
                      textAlign: 'left',
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={event.title}
                  >
                    {event.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', paddingLeft: 6 }}>
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 16, padding: '12px 0', borderTop: '1px solid var(--divider)' }}>
        {Object.entries({
          holiday: 'Holiday',
          parent_meeting: 'Parent Meeting',
          field_trip: 'Field Trip',
          assembly: 'Assembly',
          sports_day: 'Sports Day',
          graduation: 'Graduation',
          fundraiser: 'Fundraiser',
        }).map(([type, label]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                backgroundColor: getEventColor(type),
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
