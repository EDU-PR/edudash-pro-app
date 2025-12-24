/**
 * useIDCard Hook
 * Fetches and manages ID card data for a member
 */
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { CARD_TEMPLATES, CardTemplate, OrganizationMember, MemberIDCard } from '@/components/membership/types';
import { assertSupabase } from '@/lib/supabase';

// Fallback mock data - used only when real data can't be fetched
const FALLBACK_MEMBER: OrganizationMember = {
  id: '1',
  organization_id: 'org1',
  region_id: 'reg1',
  member_number: 'SOA-GP-24-00001',
  member_type: 'learner',
  first_name: 'Member',
  last_name: 'Name',
  email: 'member@email.com',
  phone: '+27 00 000 0000',
  membership_tier: 'standard',
  membership_status: 'pending',
  joined_date: new Date().toISOString(),
  expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  photo_url: null,
  province: 'Gauteng',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  organization: {
    id: 'org1',
    name: 'SOIL OF AFRICA',
    logo_url: null,
  },
  region: {
    id: 'reg1',
    organization_id: 'org1',
    name: 'Gauteng',
    code: 'GP',
    is_active: true,
    created_at: new Date().toISOString(),
  },
};

const FALLBACK_CARD: MemberIDCard = {
  id: 'card1',
  member_id: '1',
  organization_id: 'org1',
  card_number: 'SOA-XX-00-00000-C01',
  qr_code_data: '',
  status: 'active',
  issue_date: new Date().toISOString(),
  expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  card_template: 'standard',
  print_requested: false,
  printed: false,
  verification_count: 0,
  created_at: new Date().toISOString(),
};

// Generate QR code data for the card
function generateQRData(memberData: OrganizationMember, cardData: any): string {
  const qrPayload = {
    v: '1',
    mid: memberData.id,
    mn: memberData.member_number,
    mt: memberData.member_type,
    cid: cardData?.id || `virtual-${memberData.id}`,
    org: memberData.organization_id,
  };
  try {
    return btoa(JSON.stringify(qrPayload));
  } catch {
    return JSON.stringify(qrPayload);
  }
}

// Get appropriate template based on membership tier
function getMemberTierTemplate(tier: string): CardTemplate {
  switch (tier) {
    case 'vip':
    case 'premium':
      return 'premium';
    case 'honorary':
      return 'executive';
    default:
      return 'standard';
  }
}

export function useIDCard(memberId?: string) {
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<OrganizationMember>(FALLBACK_MEMBER);
  const [card, setCard] = useState<MemberIDCard>(FALLBACK_CARD);
  const [selectedTemplate, setSelectedTemplate] = useState<CardTemplate>('premium');

  const fetchMemberData = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = assertSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.replace('/landing');
        return;
      }

      let memberQuery = supabase
        .from('organization_members')
        .select(`
          *,
          organization:organizations(id, name, logo_url),
          region:organization_regions(id, organization_id, name, code, is_active, created_at)
        `);

      if (memberId) {
        memberQuery = memberQuery.eq('id', memberId);
      } else {
        memberQuery = memberQuery.eq('user_id', user.id);
      }

      const { data: memberData, error: memberError } = await memberQuery.single();

      if (memberError) {
        console.error('Error fetching member:', memberError);
        setLoading(false);
        return;
      }

      if (memberData) {
        const transformedMember: OrganizationMember = {
          id: memberData.id,
          organization_id: memberData.organization_id,
          region_id: memberData.region_id,
          member_number: memberData.member_number,
          member_type: memberData.member_type,
          first_name: memberData.first_name,
          last_name: memberData.last_name,
          email: memberData.email,
          phone: memberData.phone,
          membership_tier: memberData.membership_tier || 'standard',
          membership_status: memberData.membership_status || 'pending',
          joined_date: memberData.joined_date,
          expiry_date: memberData.expiry_date,
          photo_url: memberData.photo_url,
          province: memberData.province,
          created_at: memberData.created_at,
          updated_at: memberData.updated_at,
          organization: memberData.organization || { id: memberData.organization_id, name: 'SOIL OF AFRICA', logo_url: null },
          region: memberData.region || undefined,
        };
        
        setMember(transformedMember);

        const { data: cardData, error: cardError } = await supabase
          .from('member_id_cards')
          .select('*')
          .eq('member_id', memberData.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (cardData && !cardError) {
          setCard({
            id: cardData.id,
            member_id: cardData.member_id,
            organization_id: cardData.organization_id,
            card_number: cardData.card_number,
            qr_code_data: cardData.qr_code_data || generateQRData(transformedMember, cardData),
            status: cardData.status,
            issue_date: cardData.issue_date,
            expiry_date: cardData.expiry_date,
            card_template: cardData.card_template || 'standard',
            print_requested: cardData.print_requested || false,
            printed: cardData.printed || false,
            verification_count: cardData.verification_count || 0,
            created_at: cardData.created_at,
          });
          
          if (cardData.card_template && CARD_TEMPLATES[cardData.card_template as CardTemplate]) {
            setSelectedTemplate(cardData.card_template as CardTemplate);
          }
        } else {
          const virtualCard: MemberIDCard = {
            id: `virtual-${memberData.id}`,
            member_id: memberData.id,
            organization_id: memberData.organization_id,
            card_number: `${memberData.member_number}-C01`,
            qr_code_data: generateQRData(transformedMember, null),
            status: 'active',
            issue_date: memberData.joined_date || new Date().toISOString(),
            expiry_date: memberData.expiry_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            card_template: getMemberTierTemplate(memberData.membership_tier),
            print_requested: false,
            printed: false,
            verification_count: 0,
            created_at: memberData.created_at,
          };
          setCard(virtualCard);
          setSelectedTemplate(virtualCard.card_template as CardTemplate);
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching member data:', error);
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    fetchMemberData();
  }, [fetchMemberData]);

  return {
    loading,
    member,
    card,
    selectedTemplate,
    setSelectedTemplate,
    refetch: fetchMemberData,
  };
}
