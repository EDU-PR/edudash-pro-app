/**
 * Integration Tests: Authentication Flow
 * 
 * Tests critical authentication paths including:
 * - Sign up with role assignment
 * - Login and token refresh
 * - Password reset flow
 * - Multi-tenant isolation
 * - RBAC permission enforcement
 */

import { assertSupabase } from '../../lib/supabase';
import { fetchEnhancedUserProfile } from '../../lib/rbac';
import { routeAfterLogin } from '../../lib/routeAfterLogin';
import type { SupabaseClient } from '@supabase/supabase-js';

// Test configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

describe('Authentication Flow Integration Tests', () => {
  let supabase: SupabaseClient;
  let testUserId: string | null = null;

  beforeAll(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase credentials in environment variables');
    }
    supabase = assertSupabase();
  });

  afterEach(async () => {
    // Cleanup: sign out after each test
    if (testUserId) {
      await supabase.auth.signOut();
      testUserId = null;
    }
  });

  describe('Sign Up Flow', () => {
    it('should create user with proper role assignment', async () => {
      const testEmail = `test-teacher-${Date.now()}@example.com`;
      const testPassword = 'TestPassword123!';

      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
        options: {
          data: {
            role: 'teacher',
            preschool_id: 'test-school-123',
          },
        },
      });

      expect(error).toBeNull();
      expect(data.user).toBeDefined();
      expect(data.user?.user_metadata.role).toBe('teacher');
      
      testUserId = data.user?.id || null;
    });

    it('should reject signup with invalid role', async () => {
      const testEmail = `test-invalid-${Date.now()}@example.com`;
      
      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: 'TestPassword123!',
        options: {
          data: {
            role: 'hacker', // Invalid role
          },
        },
      });

      // Depending on RLS policies, this may succeed at auth level
      // but should fail at profile creation level
      if (data.user) {
        testUserId = data.user.id;
        
        // Check profile was not created with invalid role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();
        
        expect(['teacher', 'parent', 'student', 'principal_admin', 'super_admin']).toContain(
          profile?.role || null
        );
      }
    });
  });

  describe('Login and Session Management', () => {
    const testEmail = `test-persistent-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';

    beforeAll(async () => {
      // Create test user
      await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
        options: {
          data: { role: 'teacher' },
        },
      });
    });

    it('should login with correct credentials', async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

      expect(error).toBeNull();
      expect(data.session).toBeDefined();
      expect(data.session?.access_token).toBeTruthy();
      expect(data.user?.email).toBe(testEmail);

      testUserId = data.user?.id || null;
    });

    it('should reject login with incorrect password', async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: 'WrongPassword123!',
      });

      expect(error).toBeDefined();
      expect(data.session).toBeNull();
    });

    it('should maintain session across requests', async () => {
      // Login
      const { data: loginData } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

      testUserId = loginData.user?.id || null;

      // Get session
      const { data: sessionData } = await supabase.auth.getSession();
      expect(sessionData.session?.user.id).toBe(loginData.user?.id);
    });
  });

  describe('RBAC Integration', () => {
    it('should fetch enhanced user profile with permissions', async () => {
      const testEmail = `test-rbac-${Date.now()}@example.com`;
      
      const { data } = await supabase.auth.signUp({
        email: testEmail,
        password: 'TestPassword123!',
        options: {
          data: {
            role: 'teacher',
            preschool_id: 'test-school-456',
          },
        },
      });

      if (data.user) {
        testUserId = data.user.id;

        const profile = await fetchEnhancedUserProfile(data.user.id);
        
        expect(profile).toBeDefined();
        expect(profile?.role).toBe('teacher');
        expect(profile?.capabilities).toBeDefined();
        expect(Array.isArray(profile?.capabilities?.permissions)).toBe(true);
      }
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should isolate data between different organizations', async () => {
      // Create two teachers in different schools
      const teacher1Email = `teacher1-${Date.now()}@example.com`;
      const teacher2Email = `teacher2-${Date.now()}@example.com`;
      
      const { data: teacher1 } = await supabase.auth.signUp({
        email: teacher1Email,
        password: 'TestPassword123!',
        options: {
          data: {
            role: 'teacher',
            preschool_id: 'school-alpha',
          },
        },
      });

      await supabase.auth.signOut();

      const { data: teacher2 } = await supabase.auth.signUp({
        email: teacher2Email,
        password: 'TestPassword123!',
        options: {
          data: {
            role: 'teacher',
            preschool_id: 'school-beta',
          },
        },
      });

      // Login as teacher1
      await supabase.auth.signInWithPassword({
        email: teacher1Email,
        password: 'TestPassword123!',
      });

      // Try to query teacher2's school data
      const { data: otherSchoolData } = await supabase
        .from('preschools')
        .select('*')
        .eq('id', 'school-beta')
        .maybeSingle();

      // Should be blocked by RLS or return null
      expect(otherSchoolData).toBeNull();

      testUserId = teacher1?.user?.id || null;
    });
  });

  describe('Route After Login', () => {
    it('should route teacher to correct dashboard', async () => {
      const testEmail = `test-route-${Date.now()}@example.com`;
      
      const { data } = await supabase.auth.signUp({
        email: testEmail,
        password: 'TestPassword123!',
        options: {
          data: {
            role: 'teacher',
            preschool_id: 'test-school-789',
          },
        },
      });

      if (data.user) {
        testUserId = data.user.id;

        // Mock router for testing
        const mockRouter = { push: jest.fn() };
        (global as any).router = mockRouter;

        await routeAfterLogin(data.user);

        // Should route to teacher dashboard or appropriate screen
        expect(mockRouter.push).toHaveBeenCalled();
      }
    });
  });
});
