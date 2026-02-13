/**
 * Tests for lib/auth/roleResolution.ts
 *
 * Covers normalizeRole mapping for all known user_metadata role
 * strings → canonical RoleId values.
 */

import { normalizeRole } from '@/lib/auth/roleResolution';

describe('normalizeRole', () => {
  // ---- Direct canonical roles -------------------------------------------

  it.each([
    ['parent', 'parent'],
    ['teacher', 'teacher'],
    ['principal_admin', 'principal_admin'],
    ['super_admin', 'super_admin'],
    ['student', 'student'],
    ['admin', 'admin'],
  ])('returns canonical role "%s" → "%s"', (input, expected) => {
    expect(normalizeRole(input)).toBe(expected);
  });

  // ---- Alias / substring mappings ---------------------------------------

  it.each([
    ['principal', 'principal_admin'],
    ['superadmin', 'super_admin'],
    ['learner', 'student'],
  ])('maps alias "%s" → "%s"', (input, expected) => {
    expect(normalizeRole(input)).toBe(expected);
  });

  // ---- Substring matches ------------------------------------------------

  it('matches role containing "teacher"', () => {
    expect(normalizeRole('head_teacher')).toBe('teacher');
  });

  it('matches role containing "parent"', () => {
    expect(normalizeRole('parent_guardian')).toBe('parent');
  });

  it('matches role containing "student"', () => {
    expect(normalizeRole('student_advanced')).toBe('student');
  });

  it('matches role containing "super"', () => {
    expect(normalizeRole('super_user')).toBe('super_admin');
  });

  // ---- Edge cases: undefined / null / empty -----------------------------

  it('returns null for undefined input', () => {
    expect(normalizeRole(undefined)).toBeNull();
  });

  it('returns null for null input', () => {
    expect(normalizeRole(null as any)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeRole('')).toBeNull();
  });

  // ---- Unknown roles ----------------------------------------------------

  it('returns null for unknown role string', () => {
    expect(normalizeRole('janitor')).toBeNull();
  });

  it('returns null for numeric input', () => {
    expect(normalizeRole('42')).toBeNull();
  });

  // ---- Case insensitivity (function lowercases input) --------------------

  it('handles mixed case via lowercase conversion', () => {
    expect(normalizeRole('Parent')).toBe('parent');
    expect(normalizeRole('TEACHER')).toBe('teacher');
    expect(normalizeRole('Principal')).toBe('principal_admin');
  });
});
