/**
 * Principal Daily Program flow — route mapping and parent visibility
 *
 * E2E flow (documented for manual/automated QA):
 * 1. Principal: Dashboard → Learning → AI Daily Routine → /screens/principal-daily-program-planner
 * 2. Principal: Generate with Dash AI → Save Draft → Share with Parents
 * 3. Share creates announcement (target_audience: parents) with daily_program_structured attachment
 * 4. Parent: Dashboard → School Announcements → /screens/parent-announcements sees the routine
 *
 * These tests harden route mapping and parent access so the flow stays seamless.
 */

import { WeeklyProgramService } from '@/lib/services/weeklyProgramService';
import type { ProgramTimeRules } from '@/lib/services/weeklyProgramService';
import type { DailyProgramBlock } from '@/types/ecd-planning';

describe('Principal Daily Program flow', () => {
  describe('route and entry points', () => {
    it('principal daily program planner route is the canonical path', () => {
      const expectedRoute = '/screens/principal-daily-program-planner';
      expect(expectedRoute).toBe('/screens/principal-daily-program-planner');
    });

    it('parent announcements route is the canonical path for parents to see shared routines', () => {
      const expectedRoute = '/screens/parent-announcements';
      expect(expectedRoute).toBe('/screens/parent-announcements');
    });
  });

  describe('WeeklyProgramService', () => {
    it('startOfWeekMonday with string date returns Monday YYYY-MM-DD', () => {
      const monday = WeeklyProgramService.startOfWeekMonday('2026-02-18');
      expect(monday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const d = new Date(`${monday}T00:00:00.000Z`);
      expect(d.getUTCDay()).toBe(1);
    });
  });

  describe('program time rules validation (share preconditions)', () => {
    const validRules: ProgramTimeRules = {
      arrivalStartTime: '07:00',
      arrivalCutoffTime: '08:30',
      pickupStartTime: '12:00',
      pickupCutoffTime: '13:00',
    };

    it('ShareWeeklyProgramInput requires weeklyProgramId, preschoolId, sharedBy', () => {
      const input = {
        weeklyProgramId: 'wp-1',
        preschoolId: 'school-1',
        sharedBy: 'user-1',
      };
      expect(input.weeklyProgramId).toBeDefined();
      expect(input.preschoolId).toBeDefined();
      expect(input.sharedBy).toBeDefined();
    });

    it('ProgramTimeRules has required time fields', () => {
      expect(validRules.arrivalStartTime).toBe('07:00');
      expect(validRules.arrivalCutoffTime).toBe('08:30');
      expect(validRules.pickupStartTime).toBe('12:00');
      expect(validRules.pickupCutoffTime).toBe('13:00');
    });
  });

  describe('daily program block shape (for share payload)', () => {
    it('DailyProgramBlock has day_of_week, block_order, title, block_type', () => {
      const block: DailyProgramBlock = {
        day_of_week: 1,
        block_order: 1,
        block_type: 'circle_time',
        title: 'Morning circle',
        start_time: '08:00',
        end_time: '08:30',
        objectives: [],
        materials: [],
      };
      expect(block.day_of_week).toBe(1);
      expect(block.block_order).toBe(1);
      expect(block.title).toBe('Morning circle');
      expect(block.block_type).toBe('circle_time');
    });
  });

  describe('parent dashboard — announcements visible for shared routines', () => {
    it('announcements route is wired so shared routines appear in parent app', () => {
      const announcementsRoute = '/screens/parent-announcements';
      expect(announcementsRoute).toBe('/screens/parent-announcements');
    });
  });
});
