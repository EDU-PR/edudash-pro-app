import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  ActivityIndicator,
  Dimensions 
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { assertSupabase } from '@/lib/supabase';
import { log, logError } from '@/lib/debug';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  event_type: string;
  preschool_id: string;
  location?: string;
  start_time?: string;
  end_time?: string;
}

// Event type colors and icons
const EVENT_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  holiday: { color: '#EF4444', icon: 'sunny-outline', label: 'Holiday' },
  parent_meeting: { color: '#8B5CF6', icon: 'people-outline', label: 'Parent Meeting' },
  field_trip: { color: '#10B981', icon: 'bus-outline', label: 'Field Trip' },
  assembly: { color: '#F59E0B', icon: 'megaphone-outline', label: 'Assembly' },
  sports_day: { color: '#3B82F6', icon: 'football-outline', label: 'Sports Day' },
  graduation: { color: '#EC4899', icon: 'school-outline', label: 'Graduation' },
  fundraiser: { color: '#14B8A6', icon: 'cash-outline', label: 'Fundraiser' },
  meeting: { color: '#8B5CF6', icon: 'people-outline', label: 'Meeting' },
  activity: { color: '#10B981', icon: 'game-controller-outline', label: 'Activity' },
  assessment: { color: '#F59E0B', icon: 'clipboard-outline', label: 'Assessment' },
  other: { color: '#6B7280', icon: 'calendar-outline', label: 'Event' },
};

/**
 * Calendar Screen - Displays school events and schedules
 * 
 * Shows upcoming events for parents, teachers, and principals
 * with month navigation and event type filtering
 */
export default function CalendarScreen() {
  const { theme } = useTheme();
  const { profile, user } = useAuth();
  const { t } = useTranslation();
  const userRole = (profile?.role as string) || 'parent';
  
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedEventType, setSelectedEventType] = useState<string | null>(null);

  const styles = useMemo(() => createStyles(theme), [theme]);

  // Fetch events from database
  const fetchEvents = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const supabase = assertSupabase();
      
      // Get user's preschool_id
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('preschool_id, organization_id')
        .eq('id', user.id)
        .maybeSingle();
      
      const schoolId = userProfile?.preschool_id || userProfile?.organization_id;
      
      if (!schoolId) {
        log('📅 No school ID found for calendar');
        setEvents([]);
        return;
      }
      
      // Calculate month range
      const startOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
      const endOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59);
      
      // Try school_events table first (newer schema)
      let { data: schoolEvents, error: schoolEventsError } = await supabase
        .from('school_events')
        .select('id, title, description, start_date, event_type, preschool_id, location')
        .eq('preschool_id', schoolId)
        .gte('start_date', startOfMonth.toISOString())
        .lte('start_date', endOfMonth.toISOString())
        .order('start_date', { ascending: true });
      
      if (schoolEventsError) {
        log('📅 school_events table error, trying events table:', schoolEventsError.message);
        
        // Fallback to events table (older schema)
        const { data: legacyEvents, error: legacyError } = await supabase
          .from('events')
          .select('id, title, description, event_date, event_type, preschool_id')
          .eq('preschool_id', schoolId)
          .gte('event_date', startOfMonth.toISOString())
          .lte('event_date', endOfMonth.toISOString())
          .order('event_date', { ascending: true });
        
        if (legacyError) {
          logError('Calendar fetch error:', legacyError);
          setEvents([]);
          return;
        }
        
        setEvents(legacyEvents?.map(e => ({
          ...e,
          event_date: e.event_date
        })) || []);
        return;
      }
      
      // Map school_events to our format
      setEvents(schoolEvents?.map(e => ({
        id: e.id,
        title: e.title,
        description: e.description,
        event_date: e.start_date,
        event_type: e.event_type,
        preschool_id: e.preschool_id,
        location: e.location
      })) || []);
      
    } catch (error) {
      logError('Calendar fetch error:', error);
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, selectedMonth]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEvents();
  }, [fetchEvents]);

  // Navigate months
  const goToPreviousMonth = () => {
    setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setSelectedMonth(new Date());
  };

  // Filter events by type
  const filteredEvents = useMemo(() => {
    if (!selectedEventType) return events;
    return events.filter(e => e.event_type === selectedEventType);
  }, [events, selectedEventType]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    filteredEvents.forEach(event => {
      const dateKey = new Date(event.event_date).toISOString().split('T')[0];
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(event);
    });
    return grouped;
  }, [filteredEvents]);

  // Get unique event types for filter
  const eventTypes = useMemo(() => {
    const types = new Set(events.map(e => e.event_type));
    return Array.from(types);
  }, [events]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-ZA', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const monthYear = selectedMonth.toLocaleDateString('en-ZA', { 
    month: 'long', 
    year: 'numeric' 
  });

  const renderEventCard = (event: CalendarEvent) => {
    const config = EVENT_CONFIG[event.event_type] || EVENT_CONFIG.other;
    
    return (
      <View key={event.id} style={[styles.eventCard, { borderLeftColor: config.color }]}>
        <View style={[styles.eventIconContainer, { backgroundColor: config.color + '20' }]}>
          <Ionicons name={config.icon as any} size={20} color={config.color} />
        </View>
        <View style={styles.eventContent}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <View style={styles.eventMeta}>
            <Text style={styles.eventTime}>
              <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
              {' '}{formatTime(event.event_date)}
            </Text>
            {event.location && (
              <Text style={styles.eventLocation}>
                <Ionicons name="location-outline" size={12} color={theme.textSecondary} />
                {' '}{event.location}
              </Text>
            )}
          </View>
          {event.description && (
            <Text style={styles.eventDescription} numberOfLines={2}>
              {event.description}
            </Text>
          )}
          <View style={[styles.eventTypeBadge, { backgroundColor: config.color + '20' }]}>
            <Text style={[styles.eventTypeText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <DesktopLayout role={userRole as any} title={t('navigation.calendar', { defaultValue: 'Calendar' })}>
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        
        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={goToToday} style={styles.monthTitleContainer}>
            <Text style={styles.monthTitle}>{monthYear}</Text>
            <Text style={styles.todayHint}>{t('calendar.tap_for_today', { defaultValue: 'Tap for today' })}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Event Type Filters */}
        {eventTypes.length > 0 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filterContainer}
            contentContainerStyle={styles.filterContent}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                !selectedEventType && styles.filterChipActive
              ]}
              onPress={() => setSelectedEventType(null)}
            >
              <Text style={[
                styles.filterChipText,
                !selectedEventType && styles.filterChipTextActive
              ]}>
                {t('calendar.all_events', { defaultValue: 'All' })}
              </Text>
            </TouchableOpacity>
            {eventTypes.map(type => {
              const config = EVENT_CONFIG[type] || EVENT_CONFIG.other;
              const isActive = selectedEventType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.filterChip,
                    isActive && { backgroundColor: config.color + '20', borderColor: config.color }
                  ]}
                  onPress={() => setSelectedEventType(isActive ? null : type)}
                >
                  <Ionicons 
                    name={config.icon as any} 
                    size={14} 
                    color={isActive ? config.color : theme.textSecondary} 
                  />
                  <Text style={[
                    styles.filterChipText,
                    isActive && { color: config.color }
                  ]}>
                    {config.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Events List */}
        <ScrollView
          style={styles.eventsList}
          contentContainerStyle={styles.eventsContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={styles.loadingText}>{t('common.loading', { defaultValue: 'Loading...' })}</Text>
            </View>
          ) : Object.keys(eventsByDate).length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="calendar-outline" size={64} color={theme.textSecondary} />
              </View>
              <Text style={styles.emptyTitle}>
                {t('calendar.no_events_title', { defaultValue: 'No Events' })}
              </Text>
              <Text style={styles.emptySubtitle}>
                {t('calendar.no_events_message', { 
                  defaultValue: 'There are no events scheduled for this month.' 
                })}
              </Text>
            </View>
          ) : (
            Object.entries(eventsByDate)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, dateEvents]) => (
                <View key={date} style={styles.dateGroup}>
                  <Text style={styles.dateHeader}>{formatDate(date)}</Text>
                  {dateEvents.map(renderEventCard)}
                </View>
              ))
          )}
        </ScrollView>
      </View>
    </DesktopLayout>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: theme.background,
  },
  monthTitleContainer: {
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: isTablet ? 22 : 18,
    fontWeight: '700',
    color: theme.text,
  },
  todayHint: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
  },
  filterContainer: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
    gap: 4,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: theme.primary + '20',
    borderColor: theme.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: theme.primary,
  },
  eventsList: {
    flex: 1,
  },
  eventsContent: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  dateGroup: {
    marginBottom: 24,
  },
  dateHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
    borderLeftWidth: 4,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  eventIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  eventTime: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  eventLocation: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  eventDescription: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  eventTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  eventTypeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
