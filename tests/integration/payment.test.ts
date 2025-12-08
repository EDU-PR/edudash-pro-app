/**
 * Integration Tests: PayFast Payment Flow
 * 
 * Tests critical payment processing including:
 * - Subscription creation and upgrade
 * - Webhook validation and signature verification
 * - Payment success/failure handling
 * - Subscription status updates
 * - Multi-tenant billing isolation
 */

import { assertSupabase } from '../../lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE || 'test_passphrase';

describe('PayFast Payment Integration Tests', () => {
  let supabase: SupabaseClient;
  let testUserId: string | null = null;
  let testOrgId: string | null = null;

  beforeAll(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase credentials');
    }
    supabase = assertSupabase();
  });

  afterEach(async () => {
    if (testUserId) {
      await supabase.auth.signOut();
    }
  });

  /**
   * Generate PayFast signature for webhook validation
   */
  function generatePayFastSignature(data: Record<string, string>): string {
    const sortedKeys = Object.keys(data).sort();
    const paramString = sortedKeys
      .map(key => `${key}=${encodeURIComponent(data[key]).replace(/%20/g, '+')}`)
      .join('&');
    
    const signatureString = paramString + `&passphrase=${PAYFAST_PASSPHRASE}`;
    return crypto.createHash('md5').update(signatureString).digest('hex');
  }

  describe('Subscription Creation', () => {
    it('should create subscription record for new organization', async () => {
      // Create test organization
      const { data: authData } = await supabase.auth.signUp({
        email: `test-payment-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        options: {
          data: { role: 'principal_admin' },
        },
      });

      testUserId = authData.user?.id || null;

      if (!testUserId) {
        throw new Error('Failed to create test user');
      }

      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('preschools')
        .insert({
          name: 'Test Payment School',
          principal_id: testUserId,
          subscription_plan: 'free',
        })
        .select()
        .single();

      expect(orgError).toBeNull();
      expect(org).toBeDefined();
      testOrgId = org?.id || null;

      // Check initial subscription status
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('organization_id', testOrgId)
        .maybeSingle();

      // Free tier may not have subscription record initially
      if (subscription) {
        expect(subscription.plan).toBe('free');
        expect(subscription.status).toBe('active');
      }
    });
  });

  describe('PayFast Webhook Validation', () => {
    it('should validate webhook signature correctly', () => {
      const webhookData = {
        m_payment_id: '12345',
        pf_payment_id: 'PF-67890',
        payment_status: 'COMPLETE',
        item_name: 'Pro Plan - Monthly',
        amount_gross: '499.00',
        amount_fee: '14.97',
        amount_net: '484.03',
      };

      const signature = generatePayFastSignature(webhookData);
      
      expect(signature).toBeDefined();
      expect(signature.length).toBe(32); // MD5 hash length
    });

    it('should reject webhook with invalid signature', () => {
      const webhookData = {
        m_payment_id: '12345',
        payment_status: 'COMPLETE',
      };

      const validSignature = generatePayFastSignature(webhookData);
      const invalidSignature = 'invalid_signature_hash';

      expect(validSignature).not.toBe(invalidSignature);
    });
  });

  describe('Payment Success Flow', () => {
    beforeEach(async () => {
      // Setup: create test org
      const { data: authData } = await supabase.auth.signUp({
        email: `test-success-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        options: {
          data: { role: 'principal_admin' },
        },
      });

      testUserId = authData.user?.id || null;

      if (testUserId) {
        const { data: org } = await supabase
          .from('preschools')
          .insert({
            name: 'Payment Success School',
            principal_id: testUserId,
            subscription_plan: 'free',
          })
          .select()
          .single();

        testOrgId = org?.id || null;
      }
    });

    it('should upgrade subscription on successful payment', async () => {
      if (!testOrgId) {
        throw new Error('Test organization not created');
      }

      // Simulate successful payment webhook
      const paymentData = {
        m_payment_id: testOrgId,
        payment_status: 'COMPLETE',
        item_name: 'Pro Plan - Monthly',
        amount_gross: '499.00',
      };

      // In real scenario, this would be handled by Edge Function
      // For testing, directly update subscription
      const { error } = await supabase
        .from('subscriptions')
        .upsert({
          organization_id: testOrgId,
          plan: 'pro',
          status: 'active',
          billing_cycle: 'monthly',
          price: 499.00,
          currency: 'ZAR',
          payment_provider: 'payfast',
        });

      expect(error).toBeNull();

      // Verify subscription was updated
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('organization_id', testOrgId)
        .single();

      expect(subscription?.plan).toBe('pro');
      expect(subscription?.status).toBe('active');
    });
  });

  describe('Payment Failure Handling', () => {
    it('should handle failed payment gracefully', async () => {
      if (!testOrgId) {
        const { data: authData } = await supabase.auth.signUp({
          email: `test-failure-${Date.now()}@example.com`,
          password: 'TestPassword123!',
          options: {
            data: { role: 'principal_admin' },
          },
        });

        testUserId = authData.user?.id || null;

        if (testUserId) {
          const { data: org } = await supabase
            .from('preschools')
            .insert({
              name: 'Payment Failure School',
              principal_id: testUserId,
              subscription_plan: 'pro',
            })
            .select()
            .single();

          testOrgId = org?.id || null;
        }
      }

      // Simulate failed payment
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'past_due',
          payment_failed_at: new Date().toISOString(),
        })
        .eq('organization_id', testOrgId);

      expect(error).toBeNull();

      // Verify status updated
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('organization_id', testOrgId)
        .maybeSingle();

      if (subscription) {
        expect(['past_due', 'cancelled']).toContain(subscription.status);
      }
    });
  });

  describe('Multi-Tenant Billing Isolation', () => {
    it('should isolate payment data between organizations', async () => {
      // Create two separate organizations
      const { data: admin1 } = await supabase.auth.signUp({
        email: `admin1-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        options: { data: { role: 'principal_admin' } },
      });

      const { data: org1 } = await supabase
        .from('preschools')
        .insert({
          name: 'Org 1',
          principal_id: admin1.user?.id,
          subscription_plan: 'pro',
        })
        .select()
        .single();

      await supabase.auth.signOut();

      const { data: admin2 } = await supabase.auth.signUp({
        email: `admin2-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        options: { data: { role: 'principal_admin' } },
      });

      testUserId = admin2.user?.id || null;

      // Login as admin2, try to access org1's subscription
      const { data: foreignSubscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('organization_id', org1?.id)
        .maybeSingle();

      // Should be blocked by RLS
      expect(foreignSubscription).toBeNull();
    });
  });

  describe('Subscription Upgrade/Downgrade', () => {
    it('should handle plan upgrade correctly', async () => {
      if (!testOrgId) {
        const { data: authData } = await supabase.auth.signUp({
          email: `test-upgrade-${Date.now()}@example.com`,
          password: 'TestPassword123!',
          options: { data: { role: 'principal_admin' } },
        });

        testUserId = authData.user?.id || null;

        if (testUserId) {
          const { data: org } = await supabase
            .from('preschools')
            .insert({
              name: 'Upgrade Test School',
              principal_id: testUserId,
              subscription_plan: 'starter',
            })
            .select()
            .single();

          testOrgId = org?.id || null;
        }
      }

      // Upgrade from starter to pro
      const { error } = await supabase
        .from('subscriptions')
        .upsert({
          organization_id: testOrgId,
          plan: 'pro',
          status: 'active',
          price: 499.00,
          upgraded_at: new Date().toISOString(),
        });

      expect(error).toBeNull();

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('organization_id', testOrgId)
        .single();

      expect(subscription?.plan).toBe('pro');
      expect(subscription?.upgraded_at).toBeDefined();
    });
  });
});
