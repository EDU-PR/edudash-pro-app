/**
 * Aftercare Registration Promo Utilities
 * Handles 50% discount for 2026 aftercare registration (R400 → R200)
 */

import { assertSupabase } from '@/lib/supabase';

export interface AftercarePromoStatus {
  isActive: boolean;
  originalPrice: number;
  promoPrice: number;
  discountAmount: number;
  daysRemaining: number;
  campaignCode: string | null;
}

const ORIGINAL_REGISTRATION_FEE = 400.00;
const PROMO_END_DATE = new Date('2025-12-31T23:59:59Z');

/**
 * Check if aftercare promo is currently active
 */
export function isAftercarePromoActive(): boolean {
  const now = new Date();
  return now < PROMO_END_DATE;
}

/**
 * Get promotional price for aftercare registration
 * @param userId - User ID (optional, for user-specific checks)
 * @param userType - User type (parent, teacher, etc.)
 * @returns Promo status with pricing details
 */
export async function getAftercarePromoPrice(
  userId?: string,
  userType: 'parent' | 'teacher' | 'principal' | 'all' = 'parent'
): Promise<AftercarePromoStatus> {
  const now = new Date();
  const isActive = now < PROMO_END_DATE;
  const daysRemaining = isActive 
    ? Math.ceil((PROMO_END_DATE.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  if (!isActive || !userId) {
    return {
      isActive: false,
      originalPrice: ORIGINAL_REGISTRATION_FEE,
      promoPrice: ORIGINAL_REGISTRATION_FEE,
      discountAmount: 0,
      daysRemaining: 0,
      campaignCode: null,
    };
  }

  try {
    const supabase = assertSupabase();
    
    // Get promotional price from database function
    const { data: promoPrice, error } = await supabase.rpc('get_promotional_registration_fee', {
      p_user_id: userId,
      p_original_fee: ORIGINAL_REGISTRATION_FEE,
      p_user_type: userType,
    });

    if (error) {
      console.warn('Error fetching promo price:', error);
      return {
        isActive: false,
        originalPrice: ORIGINAL_REGISTRATION_FEE,
        promoPrice: ORIGINAL_REGISTRATION_FEE,
        discountAmount: 0,
        daysRemaining,
        campaignCode: null,
      };
    }

    const finalPrice = Number(promoPrice) || ORIGINAL_REGISTRATION_FEE;
    const discountAmount = ORIGINAL_REGISTRATION_FEE - finalPrice;
    const hasPromo = finalPrice < ORIGINAL_REGISTRATION_FEE;

    // Get campaign code
    let campaignCode: string | null = null;
    if (hasPromo) {
      const { data: campaign } = await supabase
        .from('promotional_campaigns')
        .select('code')
        .eq('applies_to_registration', true)
        .eq('product_type', 'registration')
        .eq('is_active', true)
        .gte('end_date', now.toISOString())
        .lte('start_date', now.toISOString())
        .order('discount_value', { ascending: false })
        .limit(1)
        .maybeSingle();

      campaignCode = campaign?.code || null;
    }

    return {
      isActive: hasPromo,
      originalPrice: ORIGINAL_REGISTRATION_FEE,
      promoPrice: finalPrice,
      discountAmount,
      daysRemaining,
      campaignCode,
    };
  } catch (error) {
    console.error('Error in getAftercarePromoPrice:', error);
    return {
      isActive: false,
      originalPrice: ORIGINAL_REGISTRATION_FEE,
      promoPrice: ORIGINAL_REGISTRATION_FEE,
      discountAmount: 0,
      daysRemaining,
      campaignCode: null,
    };
  }
}

/**
 * Create PayFast checkout for aftercare registration with promo
 */
export async function createAftercareRegistrationCheckout(
  registrationId: string,
  userId: string,
  userType: 'parent' | 'teacher' | 'principal' | 'all' = 'parent'
): Promise<{ checkout_url: string; transaction_id: string; amount: number; promo_applied: boolean }> {
  const supabase = assertSupabase();
  
  const { data, error } = await supabase.functions.invoke('payments-registration-fee', {
    body: {
      registration_id: registrationId,
      user_id: userId,
      original_fee: ORIGINAL_REGISTRATION_FEE,
      user_type: userType,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to create checkout');
  }

  return data;
}

