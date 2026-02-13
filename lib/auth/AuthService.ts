import { User, Session } from '@supabase/supabase-js';
import { assertSupabase } from '../supabase';
import { RoleId, ROLES } from '../rbac/types';
import {
  validatePassword,
  isValidEmail,
  getFriendlyErrorMessage,
  recordSecurityEvent,
  loadUserProfile,
  registerStudentAccount,
  createInstructorAccountFlow,
} from './accountCreation';

// ---- Types ----------------------------------------------------------------

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: 'student';
}

export interface CreateInstructorCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
}

export interface AuthResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  requiresEmailVerification?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  role: RoleId;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  capabilities?: string[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  initialized: boolean;
}

// ---- Service --------------------------------------------------------------

/**
 * Authentication Service for EduDash Pro
 *
 * Core auth lifecycle: login, logout, session refresh, role checks.
 * Account creation & validation utilities live in ./accountCreation.
 */
export class AuthService {
  private supabase = assertSupabase();
  private listeners: Array<(state: AuthState) => void> = [];
  private currentState: AuthState = {
    user: null,
    session: null,
    profile: null,
    loading: true,
    initialized: false,
  };

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    try {
      const {
        data: { session },
        error,
      } = await this.supabase.auth.getSession();

      if (error) {
        console.error('Failed to get session:', error);
      } else if (session) {
        const profile = await loadUserProfile(this.supabase, session.user.id);
        this.updateState({
          user: session.user,
          session,
          profile,
          loading: false,
          initialized: true,
        });
      } else {
        this.updateState({
          user: null,
          session: null,
          profile: null,
          loading: false,
          initialized: true,
        });
      }

      // NOTE: onAuthStateChange listener removed — AuthContext is the single
      // source of truth for auth state changes.
    } catch (error) {
      console.error('Auth initialization failed:', error);
      this.updateState({
        user: null,
        session: null,
        profile: null,
        loading: false,
        initialized: true,
      });
    }
  }

  private updateState(newState: Partial<AuthState>): void {
    this.currentState = { ...this.currentState, ...newState };
    this.listeners.forEach((listener) => listener(this.currentState));
  }

  public subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    listener(this.currentState);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  public getState(): AuthState {
    return { ...this.currentState };
  }

  // ---- Login / Logout -----------------------------------------------------

  public async login(
    credentials: LoginCredentials,
  ): Promise<AuthResponse<{ user: User; session: Session }>> {
    try {
      recordSecurityEvent(
        this.supabase,
        null,
        'login_attempt',
        `Login attempt for ${credentials.email}`,
      );

      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: credentials.email.toLowerCase(),
        password: credentials.password,
      });

      if (error) {
        recordSecurityEvent(
          this.supabase,
          null,
          'login_failed',
          error.message,
        );
        return { success: false, error: getFriendlyErrorMessage(error) };
      }

      if (!data.user || !data.session) {
        return { success: false, error: 'Login failed - invalid response' };
      }

      return { success: true, data: { user: data.user, session: data.session } };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Login failed due to an unexpected error',
      };
    }
  }

  public async logout(): Promise<AuthResponse<void>> {
    try {
      const currentUserId = this.currentState.user?.id;
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        return { success: false, error: getFriendlyErrorMessage(error) };
      }

      if (currentUserId) {
        recordSecurityEvent(
          this.supabase,
          currentUserId,
          'logout',
          'User logged out',
        );
      }
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        error: 'Logout failed due to an unexpected error',
      };
    }
  }

  // ---- Account creation (delegated) --------------------------------------

  public async registerStudent(
    credentials: RegisterCredentials,
  ): Promise<
    AuthResponse<{ user: User; requiresVerification: boolean }>
  > {
    return registerStudentAccount(this.supabase, credentials);
  }

  public async createInstructorAccount(
    credentials: CreateInstructorCredentials,
    createdBy: string,
  ): Promise<AuthResponse<{ user: User }>> {
    return createInstructorAccountFlow(
      this.supabase,
      credentials,
      createdBy,
    );
  }

  // ---- Session helpers ----------------------------------------------------

  public async refreshSession(): Promise<AuthResponse<Session>> {
    try {
      const { data, error } = await this.supabase.auth.refreshSession();
      if (error) {
        return { success: false, error: getFriendlyErrorMessage(error) };
      }
      return { success: true, data: data.session! };
    } catch (error) {
      console.error('Session refresh error:', error);
      return { success: false, error: 'Failed to refresh session' };
    }
  }

  // ---- Role & state queries -----------------------------------------------

  public isAuthenticated(): boolean {
    return !!(
      this.currentState.user &&
      this.currentState.session &&
      this.currentState.profile
    );
  }

  public hasRole(role: RoleId): boolean {
    return this.currentState.profile?.role === role;
  }

  public isAdmin(): boolean {
    return this.hasRole(ROLES.ADMIN);
  }

  public isInstructor(): boolean {
    return this.hasRole(ROLES.INSTRUCTOR);
  }

  public isStudent(): boolean {
    return this.hasRole(ROLES.STUDENT);
  }

  public getCurrentProfile(): UserProfile | null {
    return this.currentState.profile;
  }

  public getCurrentUser(): User | null {
    return this.currentState.user;
  }

  public getCurrentSession(): Session | null {
    return this.currentState.session;
  }
}

// Singleton instance
export const authService = new AuthService();
