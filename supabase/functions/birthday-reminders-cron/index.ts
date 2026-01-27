/**
 * Birthday Reminders Cron Job
 * 
 * Runs daily to send birthday reminder notifications:
 * - 7 days before: First reminder to parents
 * - 1 day before: Final reminder to parents + teacher notification
 * - Day of: Birthday wishes to the student (if applicable)
 * 
 * Also notifies teachers about upcoming birthdays in their class
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') || 'your-cron-secret'

interface StudentBirthday {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  class_id: string | null;
  parent_id: string | null;
  guardian_id: string | null;
  preschool_id: string;
  avatar_url: string | null;
}

interface BirthdayReminder {
  studentId: string;
  studentName: string;
  daysUntil: number;
  age: number;
  classId: string | null;
  className: string | null;
      parentId: string | null;
      guardianId: string | null;
      teacherId: string | null;
      preschoolId: string;
      birthdayDate: string;
}

// Calculate age they will be turning
function calculateAge(dateOfBirth: string, birthdayDate: Date): number {
  const dob = new Date(dateOfBirth);
  return birthdayDate.getFullYear() - dob.getFullYear();
}

// Get this year's birthday date
function getThisYearsBirthday(dateOfBirth: string): Date {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  const thisYearBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
  
  // If birthday has passed this year, get next year's
  if (thisYearBirthday < today) {
    thisYearBirthday.setFullYear(today.getFullYear() + 1);
  }
  
  return thisYearBirthday;
}

// Calculate days until birthday
function getDaysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

serve(async (req: Request): Promise<Response> => {
  // CORS handling
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // Verify authorization - check for service role key in header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    // Check if token matches service role key or contains service_role in JWT payload
    const isServiceRole = token === SUPABASE_SERVICE_ROLE_KEY;
    const isCronJob = token === CRON_SECRET;
    
    // Also validate by decoding JWT and checking role claim
    let isValidServiceRole = false;
    if (token && !isServiceRole && !isCronJob) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        isValidServiceRole = payload.role === 'service_role';
      } catch {
        // Invalid token format
      }
    }
    
    if (!isCronJob && !isServiceRole && !isValidServiceRole) {
      console.log('[birthday-reminders-cron] Authorization failed');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[birthday-reminders-cron] Starting birthday reminder check...');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const results = {
      parentReminders7Day: { sent: 0, failed: 0 },
      parentReminders1Day: { sent: 0, failed: 0 },
      teacherReminders: { sent: 0, failed: 0 },
      birthdayWishes: { sent: 0, failed: 0 },
      totalProcessed: 0,
    };

    // Fetch all active schools
    const { data: schools, error: schoolsError } = await supabase
      .from('preschools')
      .select('id, name')
      .eq('is_active', true);

    if (schoolsError) {
      console.error('[birthday-reminders-cron] Error fetching schools:', schoolsError);
      throw schoolsError;
    }

    console.log(`[birthday-reminders-cron] Processing ${schools?.length || 0} schools`);

    for (const school of schools || []) {
      // Fetch all students with birthdays in this school
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          first_name,
          last_name,
          date_of_birth,
          class_id,
          parent_id,
          guardian_id,
          preschool_id,
          avatar_url,
          classes(id, name, teacher_id)
        `)
        .eq('preschool_id', school.id)
        .eq('is_active', true)
        .not('date_of_birth', 'is', null);

      if (studentsError) {
        console.error(`[birthday-reminders-cron] Error fetching students for school ${school.id}:`, studentsError);
        continue;
      }

      // Process each student
      for (const student of students || []) {
        const birthdayDate = getThisYearsBirthday(student.date_of_birth);
        const daysUntil = getDaysUntil(birthdayDate);
        
        const weeklyDonationDays = [28, 21, 14, 7];
        const shouldSendWeeklyDonation = weeklyDonationDays.includes(daysUntil);

        // Only process weekly donation reminders, 1-day, and day-of birthdays
        if (!shouldSendWeeklyDonation && daysUntil !== 1 && daysUntil !== 0) {
          continue;
        }

        results.totalProcessed++;

        const classData = Array.isArray(student.classes) ? student.classes[0] : student.classes;
        const age = calculateAge(student.date_of_birth, birthdayDate);
        const studentName = `${student.first_name} ${student.last_name}`;

        const reminder: BirthdayReminder = {
          studentId: student.id,
          studentName,
          daysUntil,
          age,
          classId: student.class_id,
          className: classData?.name || null,
          parentId: student.parent_id,
          guardianId: student.guardian_id,
          teacherId: classData?.teacher_id || null,
          preschoolId: school.id,
          birthdayDate: birthdayDate.toISOString(),
        };

        // Weekly donation reminder to parent/guardian
        if (shouldSendWeeklyDonation && (student.parent_id || student.guardian_id)) {
          try {
            await supabase.functions.invoke('notifications-dispatcher', {
              body: {
                event_type: 'birthday_donation_reminder',
                user_ids: [student.parent_id, student.guardian_id].filter(Boolean),
                preschool_id: school.id,
                context: {
                  child_name: studentName,
                  student_name: student.first_name,
                  student_full_name: studentName,
                  days_until: daysUntil,
                  age: age,
                  donation_amount: 25,
                  birthday_date: birthdayDate.toLocaleDateString('en-ZA', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  }),
                  class_name: reminder.className,
                  school_name: school.name,
                },
              },
            });
            results.parentReminders7Day.sent++;
            console.log(`[birthday-reminders-cron] Sent donation reminder (${daysUntil} days) for ${studentName}`);
          } catch (err) {
            console.error(`[birthday-reminders-cron] Failed donation reminder for ${studentName}:`, err);
            results.parentReminders7Day.failed++;
          }
        }

        // 1-day reminder to parent
        if (daysUntil === 1 && (student.parent_id || student.guardian_id)) {
          try {
            await supabase.functions.invoke('notifications-dispatcher', {
              body: {
                event_type: 'birthday_reminder_tomorrow',
                user_ids: [student.parent_id, student.guardian_id].filter(Boolean),
                preschool_id: school.id,
                context: {
                  student_name: student.first_name,
                  student_full_name: studentName,
                  age: age,
                  class_name: reminder.className,
                  school_name: school.name,
                },
              },
            });
            results.parentReminders1Day.sent++;
            console.log(`[birthday-reminders-cron] Sent 1-day reminder for ${studentName}`);
          } catch (err) {
            console.error(`[birthday-reminders-cron] Failed 1-day reminder for ${studentName}:`, err);
            results.parentReminders1Day.failed++;
          }
        }

        // Teacher notification (1 day before)
        if (daysUntil === 1 && reminder.teacherId) {
          try {
            await supabase.functions.invoke('notifications-dispatcher', {
              body: {
                event_type: 'birthday_reminder_teacher',
                user_ids: [reminder.teacherId],
                preschool_id: school.id,
                context: {
                  student_name: student.first_name,
                  student_full_name: studentName,
                  age: age,
                  class_name: reminder.className,
                },
              },
            });
            results.teacherReminders.sent++;
            console.log(`[birthday-reminders-cron] Sent teacher reminder for ${studentName}`);
          } catch (err) {
            console.error(`[birthday-reminders-cron] Failed teacher reminder for ${studentName}:`, err);
            results.teacherReminders.failed++;
          }
        }

        // Day-of birthday wishes
        if (daysUntil === 0) {
          // Notify parent/guardian with birthday wishes
          if (student.parent_id || student.guardian_id) {
            try {
              await supabase.functions.invoke('notifications-dispatcher', {
                body: {
                  event_type: 'birthday_today',
                  user_ids: [student.parent_id, student.guardian_id].filter(Boolean),
                  preschool_id: school.id,
                  context: {
                    student_name: student.first_name,
                    student_full_name: studentName,
                    age: age,
                    school_name: school.name,
                  },
                },
              });
              results.birthdayWishes.sent++;
              console.log(`[birthday-reminders-cron] Sent birthday wishes for ${studentName}`);
            } catch (err) {
              console.error(`[birthday-reminders-cron] Failed birthday wishes for ${studentName}:`, err);
              results.birthdayWishes.failed++;
            }
          }

          // Notify teacher about today's birthday
          if (reminder.teacherId) {
            try {
              await supabase.functions.invoke('notifications-dispatcher', {
                body: {
                  event_type: 'birthday_today_teacher',
                  user_ids: [reminder.teacherId],
                  preschool_id: school.id,
                  context: {
                    student_name: student.first_name,
                    student_full_name: studentName,
                    age: age,
                    class_name: reminder.className,
                  },
                },
              });
            } catch (err) {
              console.error(`[birthday-reminders-cron] Failed teacher birthday alert for ${studentName}:`, err);
            }
          }
        }
      }
    }

    console.log('[birthday-reminders-cron] Completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[birthday-reminders-cron] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
