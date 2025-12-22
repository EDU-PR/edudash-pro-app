/**
 * Types and constants for the Campaigns feature
 */

// Campaign type enum
export type CampaignType = 
  | 'early_bird' 
  | 'sibling_discount' 
  | 'referral_bonus' 
  | 'seasonal_promo' 
  | 'bundle_offer' 
  | 'scholarship';

// Discount type enum
export type DiscountType = 
  | 'percentage' 
  | 'fixed_amount' 
  | 'waive_registration' 
  | 'first_month_free';

// Campaign interface
export interface Campaign {
  id: string;
  organization_id: string;
  name: string;
  campaign_type: CampaignType;
  description?: string;
  terms_conditions?: string;
  discount_type: DiscountType;
  discount_value?: number;
  max_discount_amount?: number;
  promo_code?: string;
  max_redemptions?: number;
  current_redemptions: number;
  start_date: string;
  end_date: string;
  active: boolean;
  featured: boolean;
  views_count: number;
  conversions_count: number;
  created_at: string;
}

// Campaign form state
export interface CampaignFormState {
  name: string;
  type: CampaignType;
  description: string;
  discountType: DiscountType;
  discountValue: string;
  promoCode: string;
  maxRedemptions: string;
  active: boolean;
  featured: boolean;
}

// Campaign type metadata
export interface CampaignTypeInfo {
  label: string;
  icon: string;
  color: string;
}

// Campaign type labels with icons and colors
export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, CampaignTypeInfo> = {
  early_bird: { label: 'Early Bird', icon: 'sunny', color: '#f59e0b' },
  sibling_discount: { label: 'Sibling Discount', icon: 'people', color: '#8b5cf6' },
  referral_bonus: { label: 'Referral Bonus', icon: 'share-social', color: '#22c55e' },
  seasonal_promo: { label: 'Seasonal Promo', icon: 'calendar', color: '#3b82f6' },
  bundle_offer: { label: 'Bundle Offer', icon: 'gift', color: '#ec4899' },
  scholarship: { label: 'Scholarship', icon: 'school', color: '#14b8a6' },
};

// Discount type labels
export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  percentage: 'Percentage Off',
  fixed_amount: 'Fixed Amount Off',
  waive_registration: 'Waive Registration',
  first_month_free: 'First Month Free',
};

// Initial form state
export const INITIAL_FORM_STATE: CampaignFormState = {
  name: '',
  type: 'early_bird',
  description: '',
  discountType: 'percentage',
  discountValue: '',
  promoCode: '',
  maxRedemptions: '',
  active: true,
  featured: false,
};

// Helper to get discount display text
export function getDiscountDisplayText(campaign: Campaign): string {
  switch (campaign.discount_type) {
    case 'percentage':
      return `${campaign.discount_value}% off`;
    case 'fixed_amount':
      return `R${campaign.discount_value} off`;
    case 'waive_registration':
      return 'Registration waived';
    case 'first_month_free':
      return 'First month free';
    default:
      return '';
  }
}
