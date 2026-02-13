/**
 * Tests for lib/auth/accountCreation.ts — validation utilities
 *
 * Pure function tests for validatePassword, isValidEmail,
 * and getFriendlyErrorMessage.
 */

import {
  validatePassword,
  isValidEmail,
  getFriendlyErrorMessage,
} from '@/lib/auth/accountCreation';
import { AuthError } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// validatePassword
// ---------------------------------------------------------------------------

describe('validatePassword', () => {
  it('rejects empty password', () => {
    const result = validatePassword('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects short password', () => {
    const result = validatePassword('Ab1!');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('8 characters');
  });

  it('rejects password without lowercase', () => {
    const result = validatePassword('ABCDEFG1!');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('lowercase');
  });

  it('rejects password without uppercase', () => {
    const result = validatePassword('abcdefg1!');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('uppercase');
  });

  it('rejects password without numbers', () => {
    const result = validatePassword('Abcdefgh!');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('number');
  });

  it('rejects password without symbols', () => {
    const result = validatePassword('Abcdefg1');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('symbol');
  });

  it('accepts a strong password', () => {
    const result = validatePassword('StrongP@ss1');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts minimum valid password', () => {
    const result = validatePassword('aB1!xxxx');
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isValidEmail
// ---------------------------------------------------------------------------

describe('isValidEmail', () => {
  it.each([
    ['user@example.com', true],
    ['first.last@domain.co.za', true],
    ['name+tag@sub.domain.org', true],
    ['bad@', false],
    ['@domain.com', false],
    ['noatsign', false],
    ['', false],
    ['spaces in@email.com', false],
  ])('isValidEmail("%s") → %s', (input, expected) => {
    expect(isValidEmail(input)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// getFriendlyErrorMessage
// ---------------------------------------------------------------------------

describe('getFriendlyErrorMessage', () => {
  const makeError = (message: string): AuthError => {
    const err = new Error(message) as AuthError;
    err.name = 'AuthApiError';
    err.status = 400;
    return err;
  };

  it('maps "Invalid login credentials"', () => {
    const msg = getFriendlyErrorMessage(makeError('Invalid login credentials'));
    expect(msg).toContain('Invalid email or password');
  });

  it('maps "Email not confirmed"', () => {
    const msg = getFriendlyErrorMessage(makeError('Email not confirmed'));
    expect(msg).toContain('confirmation link');
  });

  it('maps "User already registered"', () => {
    const msg = getFriendlyErrorMessage(makeError('User already registered'));
    expect(msg).toContain('already exists');
  });

  it('returns original message for unknown errors', () => {
    const msg = getFriendlyErrorMessage(makeError('Something weird'));
    expect(msg).toBe('Something weird');
  });

  it('returns fallback for empty message', () => {
    const msg = getFriendlyErrorMessage(makeError(''));
    expect(msg).toContain('unexpected error');
  });
});
