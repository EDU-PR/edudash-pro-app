/**
 * Birthday Planner Service
 * 
 * Provides birthday tracking, notifications, and planning features for preschools.
 * - Tracks upcoming student birthdays from date_of_birth
 * - Sends advance notifications to parents and teachers
 * - Manages birthday celebration preferences per student
 * - Integrates with school calendar and notifications
 */

import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

const TAG = 'BirthdayPlanner';

// Types
export interface StudentBirthday {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  birthDate: Date; // This year's birthday
  age: number; // Age they're turning
  daysUntil: number;
  classId?: string;
  className?: string;
  parentId?: string;
  parentName?: string;
  photoUrl?: string;
  celebrationPreferences?: BirthdayCelebrationPreferences;
}

export interface BirthdayCelebrationPreferences {
  id?: string;
  studentId: string;
  wantsSchoolCelebration: boolean;
  allergies?: string[];
  dietaryRestrictions?: string[];
  preferredTheme?: string;
  specialRequests?: string;
  parentBringingTreats: boolean;
  treatsDescription?: string;
  guestCount?: number;
  notifyClassmates: boolean;
  updatedAt?: string;
}

export interface BirthdayCalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'student_birthday';
  studentId: string;
  studentName: string;
  age: number;
  classId?: string;
  className?: string;
}

export interface UpcomingBirthdaysResponse {
  today: StudentBirthday[];
  thisWeek: StudentBirthday[];
  thisMonth: StudentBirthday[];
  nextMonth: StudentBirthday[];
}

// Helper functions
const calculateAge = (dateOfBirth: string, onDate: Date = new Date()): number => {
  const dob = new Date(dateOfBirth);
  let age = onDate.getFullYear() - dob.getFullYear();
  const monthDiff = onDate.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && onDate.getDate() < dob.getDate())) {
    age--;
  }
  return Math.max(age, 0); // Age on the target date (birthday)
};

const getThisYearsBirthday = (dateOfBirth: string): Date => {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  const thisYearBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
  
  // If birthday has passed this year, get next year's
  if (thisYearBirthday < today) {
    thisYearBirthday.setFullYear(today.getFullYear() + 1);
  }
  
  return thisYearBirthday;
};

const getDaysUntil = (date: Date): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Birthday Planner Service
 */
export class BirthdayPlannerService {
  private static prefsTableState: 'unknown' | 'available' | 'missing' = 'unknown';
  private static prefsTableStateHydration: Promise<void> | null = null;
  private static readonly PREFS_TABLE_STATE_CACHE_KEY = '@birthday_prefs_table_state_v2';
  private static readonly PREFS_TABLE_STATE_CACHE_TTL_MS = 60 * 60 * 1000;

  private static async ensurePrefsTableStateLoaded(): Promise<void> {
    if (this.prefsTableStateHydration) {
      await this.prefsTableStateHydration;
      return;
    }

    this.prefsTableStateHydration = (async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        if (!AsyncStorage?.getItem) return;
        const raw = await AsyncStorage.getItem(this.PREFS_TABLE_STATE_CACHE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as { state?: 'available' | 'missing'; checkedAt?: number };
        const checkedAt = Number(parsed?.checkedAt || 0);
        const ageMs = Date.now() - checkedAt;
        if (!parsed?.state || !Number.isFinite(ageMs) || ageMs > this.PREFS_TABLE_STATE_CACHE_TTL_MS) {
          return;
        }

        this.prefsTableState = parsed.state;
      } catch {
        // Ignore cache errors and continue probing in runtime.
      }
    })();

    await this.prefsTableStateHydration;
  }

  private static persistPrefsTableState(state: 'available' | 'missing'): void {
    void (async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        if (!AsyncStorage?.setItem) return;
        await AsyncStorage.setItem(
          this.PREFS_TABLE_STATE_CACHE_KEY,
          JSON.stringify({ state, checkedAt: Date.now() })
        );
      } catch {
        // Ignore persistence errors.
      }
    })();
  }

  private static isPrefsTableMissing(error: any): boolean {
    const status = error?.status ?? error?.statusCode;
    const code = error?.code;
    const message = String(error?.message || '').toLowerCase();
    return (
      status === 404 ||
      code === 'PGRST205' ||
      message.includes('birthday_celebration_preferences')
    );
  }

  private static markPrefsTableMissingOnce(error: any): boolean {
    if (!this.isPrefsTableMissing(error)) return false;
    if (this.prefsTableState !== 'missing') {
      console.warn('[BirthdayPlannerService] birthday_celebration_preferences table missing - preferences disabled.');
    }
    this.prefsTableState = 'missing';
    this.persistPrefsTableState('missing');
    return true;
  }

  private static markPrefsTableAvailable(): void {
    this.prefsTableState = 'available';
    this.persistPrefsTableState('available');
  }

  /**
   * Get all upcoming birthdays for a preschool
   */
  static async getUpcomingBirthdays(
    preschoolId: string,
    daysAhead: number = 90
  ): Promise<UpcomingBirthdaysResponse> {
    try {
      await this.ensurePrefsTableStateLoaded();
      const supabase = assertSupabase();
      
      // Fetch all active students with their class info
      // Note: Parent info fetched separately to avoid FK join issues with RLS
      const { data: students, error } = await supabase
        .from('students')
        .select(`
          id,
          first_name,
          last_name,
          date_of_birth,
          avatar_url,
          class_id,
          parent_id,
          classes!students_class_id_fkey(name)
        `)
        .eq('preschool_id', preschoolId)
        .eq('is_active', true)
        .not('date_of_birth', 'is', null);

      if (error) {
        console.error('[BirthdayPlannerService] Error fetching students:', error);
        throw error;
      }

      // Fetch celebration preferences for all students
      const studentIds = (students || []).map(s => s.id);
      let preferencesMap = new Map<string, BirthdayCelebrationPreferences>();
      
      if (studentIds.length > 0 && this.prefsTableState !== 'missing') {
        const { data: preferences, error: prefError } = await supabase
          .from('birthday_celebration_preferences')
          .select('*')
          .in('student_id', studentIds);
        
        if (prefError) {
          if (!this.markPrefsTableMissingOnce(prefError)) {
            console.error('[BirthdayPlannerService] Error fetching preferences:', prefError);
          }
        } else {
          this.markPrefsTableAvailable();
          (preferences || []).forEach((pref: any) => {
            preferencesMap.set(pref.student_id, {
              id: pref.id,
              studentId: pref.student_id,
              wantsSchoolCelebration: pref.wants_school_celebration ?? true,
              allergies: pref.allergies || [],
              dietaryRestrictions: pref.dietary_restrictions || [],
              preferredTheme: pref.preferred_theme,
              specialRequests: pref.special_requests,
              parentBringingTreats: pref.parent_bringing_treats ?? false,
              treatsDescription: pref.treats_description,
              guestCount: pref.guest_count,
              notifyClassmates: pref.notify_classmates ?? true,
              updatedAt: pref.updated_at,
            });
          });
        }
      }

      // Process students into birthday entries
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const cutoffDate = new Date(today);
      cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

      const birthdays: StudentBirthday[] = (students || [])
        .map((student: any) => {
          const birthDate = getThisYearsBirthday(student.date_of_birth);
          const daysUntil = getDaysUntil(birthDate);
          
          // Only include if within range
          if (daysUntil < 0 || daysUntil > daysAhead) return null;
          
          const classData = Array.isArray(student.classes) ? student.classes[0] : student.classes;
          
          return {
            id: `birthday-${student.id}`,
            studentId: student.id,
            firstName: student.first_name,
            lastName: student.last_name,
            dateOfBirth: student.date_of_birth,
            birthDate,
            age: calculateAge(student.date_of_birth, birthDate),
            daysUntil,
            classId: student.class_id,
            className: classData?.name,
            parentId: student.parent_id,
            parentName: undefined, // Parent names fetched separately if needed
            photoUrl: student.avatar_url,
            celebrationPreferences: preferencesMap.get(student.id),
          };
        })
        .filter(Boolean) as StudentBirthday[];

      // Sort by days until
      birthdays.sort((a, b) => a.daysUntil - b.daysUntil);

      // Categorize
      const todayBirthdays = birthdays.filter(b => b.daysUntil === 0);
      const thisWeek = birthdays.filter(b => b.daysUntil > 0 && b.daysUntil <= 7);
      const thisMonth = birthdays.filter(b => b.daysUntil > 7 && b.daysUntil <= 30);
      const nextMonth = birthdays.filter(b => b.daysUntil > 30 && b.daysUntil <= 60);

      return {
        today: todayBirthdays,
        thisWeek,
        thisMonth,
        nextMonth,
      };
    } catch (error) {
      console.error('[BirthdayPlannerService] Error:', error);
      return {
        today: [],
        thisWeek: [],
        thisMonth: [],
        nextMonth: [],
      };
    }
  }

  /**
   * Get birthdays for a specific class
   */
  static async getClassBirthdays(
    classId: string,
    daysAhead: number = 30
  ): Promise<StudentBirthday[]> {
    try {
      const supabase = assertSupabase();
      
      const { data: students, error } = await supabase
        .from('students')
        .select(`
          id,
          first_name,
          last_name,
          date_of_birth,
          avatar_url,
          class_id,
          parent_id,
          classes!students_class_id_fkey(name)
        `)
        .eq('class_id', classId)
        .eq('is_active', true)
        .not('date_of_birth', 'is', null);

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const birthdays: StudentBirthday[] = (students || [])
        .map((student: any) => {
          const birthDate = getThisYearsBirthday(student.date_of_birth);
          const daysUntil = getDaysUntil(birthDate);
          
          if (daysUntil < 0 || daysUntil > daysAhead) return null;
          
          const classData = Array.isArray(student.classes) ? student.classes[0] : student.classes;
          
          return {
            id: `birthday-${student.id}`,
            studentId: student.id,
            firstName: student.first_name,
            lastName: student.last_name,
            dateOfBirth: student.date_of_birth,
            birthDate,
            age: calculateAge(student.date_of_birth, birthDate),
            daysUntil,
            classId: student.class_id,
            className: classData?.name,
            parentId: student.parent_id,
            parentName: undefined, // Parent names fetched separately if needed
            photoUrl: student.avatar_url,
          };
        })
        .filter(Boolean) as StudentBirthday[];

      return birthdays.sort((a, b) => a.daysUntil - b.daysUntil);
    } catch (error) {
      console.error('[BirthdayPlannerService] Error fetching class birthdays:', error);
      return [];
    }
  }

  /**
   * Get ALL birthdays for a school year (for birthday chart display)
   * Returns all students with birthdays, regardless of how far away
   */
  static async getAllBirthdays(preschoolId: string, year?: number): Promise<StudentBirthday[]> {
    try {
      const supabase = assertSupabase();
      const targetYear = year ?? new Date().getFullYear();
      const debugEnabled = process.env.EXPO_PUBLIC_DEBUG_MODE === 'true' || __DEV__;
      
      if (debugEnabled) {
        logger.debug(TAG, 'getAllBirthdays - Fetching for preschoolId:', preschoolId);
        logger.debug(TAG, 'getAllBirthdays - Target year:', targetYear);
      }
      
      // First, count total students to help diagnose issues
      const { count: totalStudents } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('preschool_id', preschoolId)
        .eq('is_active', true);
      
      if (debugEnabled) {
        logger.debug(TAG, 'getAllBirthdays - Total active students:', totalStudents);
      }
      
      // Simplified query - fetch students with classes only, get parent info separately if needed
      // This matches how student-detail.tsx fetches data successfully
      const { data: students, error } = await supabase
        .from('students')
        .select(`
          id,
          first_name,
          last_name,
          date_of_birth,
          avatar_url,
          class_id,
          parent_id,
          classes!students_class_id_fkey(name)
        `)
        .eq('preschool_id', preschoolId)
        .eq('is_active', true)
        .not('date_of_birth', 'is', null);

      if (error) {
        console.error('[BirthdayPlannerService.getAllBirthdays] Query error:', error);
        throw error;
      }
      
      if (debugEnabled) {
        logger.debug(TAG, 'getAllBirthdays - Students with DOB:', students?.length || 0);
        logger.debug(TAG, 'getAllBirthdays - Students without DOB:', (totalStudents || 0) - (students?.length || 0));
      }
      
      // Debug: Log first few students to verify DOB format
      if (debugEnabled) {
        if (students && students.length > 0) {
          logger.debug(TAG, 'getAllBirthdays - Sample DOB:', students.slice(0, 3).map(s => ({
            name: `${s.first_name} ${s.last_name}`,
            dob: s.date_of_birth
          })));
        } else {
          logger.debug(TAG, 'getAllBirthdays - No students with DOB found - check if date_of_birth is populated in student profiles');
        }
      }

      const birthdays: StudentBirthday[] = (students || [])
        .map((student: any) => {
          const dob = new Date(student.date_of_birth);
          const birthDate = new Date(targetYear, dob.getMonth(), dob.getDate());
          const daysUntil = getDaysUntil(birthDate);
          
          const classData = Array.isArray(student.classes) ? student.classes[0] : student.classes;
          
          return {
            id: `birthday-${student.id}`,
            studentId: student.id,
            firstName: student.first_name,
            lastName: student.last_name,
            dateOfBirth: student.date_of_birth,
            birthDate,
            age: calculateAge(student.date_of_birth, birthDate),
            daysUntil,
            classId: student.class_id,
            className: classData?.name,
            parentId: student.parent_id,
            parentName: undefined, // Skip parent lookup for performance - not essential for birthday chart
            photoUrl: student.avatar_url,
          };
        });

      // Sort by birth month and day
      return birthdays.sort((a, b) => {
        const aDate = new Date(a.dateOfBirth);
        const bDate = new Date(b.dateOfBirth);
        const monthDiff = aDate.getMonth() - bDate.getMonth();
        if (monthDiff !== 0) return monthDiff;
        return aDate.getDate() - bDate.getDate();
      });
    } catch (error) {
      console.error('[BirthdayPlannerService] Error fetching all birthdays:', error);
      return [];
    }
  }

  /**
   * Get birthday for a specific student (parent view)
   */
  static async getStudentBirthday(studentId: string): Promise<StudentBirthday | null> {
    try {
      await this.ensurePrefsTableStateLoaded();
      const supabase = assertSupabase();
      
      const { data: student, error } = await supabase
        .from('students')
        .select(`
          id,
          first_name,
          last_name,
          date_of_birth,
          avatar_url,
          class_id,
          parent_id,
          preschool_id,
          classes!students_class_id_fkey(name)
        `)
        .eq('id', studentId)
        .single();

      if (error || !student?.date_of_birth) return null;

      // Get preferences
      let prefData: any = null;
      if (this.prefsTableState !== 'missing') {
        const { data, error: prefError } = await supabase
          .from('birthday_celebration_preferences')
          .select('*')
          .eq('student_id', studentId)
          .maybeSingle();
        
        if (prefError) {
          if (!this.markPrefsTableMissingOnce(prefError)) {
            console.error('[BirthdayPlannerService] Error fetching preferences:', prefError);
          }
        } else {
          this.markPrefsTableAvailable();
          prefData = data;
        }
      }

      const birthDate = getThisYearsBirthday(student.date_of_birth);
      const daysUntil = getDaysUntil(birthDate);
      const classData = Array.isArray(student.classes) ? student.classes[0] : student.classes;

      const preferences: BirthdayCelebrationPreferences | undefined = prefData ? {
        id: prefData.id,
        studentId: prefData.student_id,
        wantsSchoolCelebration: prefData.wants_school_celebration ?? true,
        allergies: prefData.allergies || [],
        dietaryRestrictions: prefData.dietary_restrictions || [],
        preferredTheme: prefData.preferred_theme,
        specialRequests: prefData.special_requests,
        parentBringingTreats: prefData.parent_bringing_treats ?? false,
        treatsDescription: prefData.treats_description,
        guestCount: prefData.guest_count,
        notifyClassmates: prefData.notify_classmates ?? true,
        updatedAt: prefData.updated_at,
      } : undefined;

      return {
        id: `birthday-${student.id}`,
        studentId: student.id,
        firstName: student.first_name,
        lastName: student.last_name,
        dateOfBirth: student.date_of_birth,
        birthDate,
        age: calculateAge(student.date_of_birth, birthDate),
        daysUntil,
        classId: student.class_id,
        className: classData?.name,
        parentId: student.parent_id,
        photoUrl: student.avatar_url,
        celebrationPreferences: preferences,
      };
    } catch (error) {
      console.error('[BirthdayPlannerService] Error fetching student birthday:', error);
      return null;
    }
  }

  /**
   * Save or update celebration preferences (parent action)
   */
  static async saveCelebrationPreferences(
    studentId: string,
    preferences: Partial<BirthdayCelebrationPreferences>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ensurePrefsTableStateLoaded();
      if (this.prefsTableState === 'missing') {
        return { success: false, error: 'Birthday preferences are not available yet.' };
      }

      const supabase = assertSupabase();
      
      const { data: existing, error: existingError } = await supabase
        .from('birthday_celebration_preferences')
        .select('id')
        .eq('student_id', studentId)
        .maybeSingle();
      
      if (existingError) {
        if (this.markPrefsTableMissingOnce(existingError)) {
          return { success: false, error: 'Birthday preferences are not available yet.' };
        }
        throw existingError;
      }

      const prefData = {
        student_id: studentId,
        wants_school_celebration: preferences.wantsSchoolCelebration ?? true,
        allergies: preferences.allergies || [],
        dietary_restrictions: preferences.dietaryRestrictions || [],
        preferred_theme: preferences.preferredTheme,
        special_requests: preferences.specialRequests,
        parent_bringing_treats: preferences.parentBringingTreats ?? false,
        treats_description: preferences.treatsDescription,
        guest_count: preferences.guestCount,
        notify_classmates: preferences.notifyClassmates ?? true,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabase
          .from('birthday_celebration_preferences')
          .update(prefData)
          .eq('id', existing.id);
        
        if (error) {
          if (this.markPrefsTableMissingOnce(error)) {
            return { success: false, error: 'Birthday preferences are not available yet.' };
          }
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('birthday_celebration_preferences')
          .insert(prefData);
        
        if (error) {
          if (this.markPrefsTableMissingOnce(error)) {
            return { success: false, error: 'Birthday preferences are not available yet.' };
          }
          throw error;
        }
      }

      return { success: true };
    } catch (error: any) {
      console.error('[BirthdayPlannerService] Error saving preferences:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get birthdays as calendar events for a month
   */
  static async getBirthdayCalendarEvents(
    preschoolId: string,
    year: number,
    month: number
  ): Promise<BirthdayCalendarEvent[]> {
    try {
      const supabase = assertSupabase();
      
      const { data: students, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, date_of_birth, class_id, classes!students_class_id_fkey(name)')
        .eq('preschool_id', preschoolId)
        .eq('is_active', true)
        .not('date_of_birth', 'is', null);

      if (error) throw error;

      const events: BirthdayCalendarEvent[] = [];
      
      (students || []).forEach((student: any) => {
        const dob = new Date(student.date_of_birth);
        
        // Check if birthday falls in the requested month
        if (dob.getMonth() === month) {
          const birthdayDate = new Date(year, month, dob.getDate());
          const classData = Array.isArray(student.classes) ? student.classes[0] : student.classes;
          
          events.push({
            id: `birthday-${student.id}-${year}-${month}`,
            title: `🎂 ${student.first_name}'s Birthday`,
            date: birthdayDate.toISOString(),
            type: 'student_birthday',
            studentId: student.id,
            studentName: `${student.first_name} ${student.last_name}`,
            age: calculateAge(student.date_of_birth, birthdayDate),
            classId: student.class_id,
            className: classData?.name,
          });
        }
      });

      return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } catch (error) {
      console.error('[BirthdayPlannerService] Error fetching birthday events:', error);
      return [];
    }
  }

  /**
   * Send birthday reminder notifications
   * Called by cron job - notifies parents 1 week and 1 day before
   */
  static async sendBirthdayReminders(preschoolId: string): Promise<{
    sent: number;
    failed: number;
  }> {
    try {
      const supabase = assertSupabase();
      const results = { sent: 0, failed: 0 };

      // Get birthdays coming up in 7 days and 1 day
      const { thisWeek } = await this.getUpcomingBirthdays(preschoolId, 7);
      
      for (const birthday of thisWeek) {
        // Only send reminders for 7-day and 1-day marks
        if (birthday.daysUntil !== 7 && birthday.daysUntil !== 1) continue;
        
        try {
          // Notify parent
          if (birthday.parentId) {
            await supabase.functions.invoke('notifications-dispatcher', {
              body: {
                event_type: 'birthday_reminder',
                user_id: birthday.parentId,
                preschool_id: preschoolId,
                context: {
                  student_name: `${birthday.firstName} ${birthday.lastName}`,
                  days_until: birthday.daysUntil,
                  age: birthday.age,
                  birthday_date: birthday.birthDate.toISOString(),
                },
              },
            });
            results.sent++;
          }

          // Notify teacher if within 1 day
          if (birthday.daysUntil === 1 && birthday.classId) {
            const { data: classData } = await supabase
              .from('classes')
              .select('teacher_id')
              .eq('id', birthday.classId)
              .single();

            if (classData?.teacher_id) {
              await supabase.functions.invoke('notifications-dispatcher', {
                body: {
                  event_type: 'birthday_reminder_teacher',
                  user_id: classData.teacher_id,
                  preschool_id: preschoolId,
                  context: {
                    student_name: `${birthday.firstName} ${birthday.lastName}`,
                    class_name: birthday.className,
                    age: birthday.age,
                  },
                },
              });
              results.sent++;
            }
          }
        } catch (err) {
          console.error(`[BirthdayPlannerService] Failed to send reminder for ${birthday.studentId}:`, err);
          results.failed++;
        }
      }

      return results;
    } catch (error) {
      console.error('[BirthdayPlannerService] Error sending reminders:', error);
      return { sent: 0, failed: 0 };
    }
  }
}

export default BirthdayPlannerService;
