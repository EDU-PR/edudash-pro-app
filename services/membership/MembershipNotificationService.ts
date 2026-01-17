/**
 * Membership Notification Service
 * 
 * Handles all notifications related to member registration,
 * pending approvals, and removal requests.
 * 
 * @module MembershipNotificationService
 */

import { assertSupabase } from '@/lib/supabase';

export interface NewMemberRegistration {
  id: string;
  organization_id: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  member_type?: string;
  region_id?: string;
  region_name?: string;
  requested_role?: string;
}

export interface PendingRemovalRequest {
  member_id: string;
  organization_id: string;
  member_name: string;
  member_type: string;
  requested_by_name?: string;
  requested_by_id?: string;
  region_name?: string;
}

export class MembershipNotificationService {
  
  // ============================================================================
  // NEW MEMBER REGISTRATION NOTIFICATIONS
  // ============================================================================

  /**
   * Notify youth president of new member registration
   * Triggered when a new member joins via invite code or website
   */
  static async notifyPresidentOfNewRegistration(
    registration: NewMemberRegistration,
    wing: 'youth' | 'women' | 'veterans' | 'main' = 'youth'
  ): Promise<void> {
    try {
      const supabase = assertSupabase();

      // Determine which president to notify based on wing
      const presidentTypes: Record<string, string> = {
        'youth': 'youth_president',
        'women': 'women_president',
        'veterans': 'veterans_president',
        'main': 'president',
      };
      const targetPresidentType = presidentTypes[wing] || 'youth_president';

      // Find the president for this organization
      const { data: president, error: presidentError } = await supabase
        .from('organization_members')
        .select('user_id, first_name, last_name')
        .eq('organization_id', registration.organization_id)
        .eq('member_type', targetPresidentType)
        .eq('membership_status', 'active')
        .maybeSingle();

      if (presidentError || !president) {
        // Try fallback to national admin or CEO
        const { data: fallbackAdmin } = await supabase
          .from('organization_members')
          .select('user_id, first_name, last_name')
          .eq('organization_id', registration.organization_id)
          .in('member_type', ['national_admin', 'ceo', 'president'])
          .eq('membership_status', 'active')
          .limit(1)
          .maybeSingle();

        if (!fallbackAdmin) {
          console.warn(`[MembershipNotificationService] No ${targetPresidentType} or admin found for org:`, registration.organization_id);
          return;
        }

        // Use fallback admin
        await MembershipNotificationService.sendRegistrationNotification(
          fallbackAdmin.user_id,
          registration,
          wing
        );
        return;
      }

      await MembershipNotificationService.sendRegistrationNotification(
        president.user_id,
        registration,
        wing
      );

      console.log(`✅ Notified ${targetPresidentType} of new registration: ${registration.first_name} ${registration.last_name}`);
    } catch (error) {
      console.error('[MembershipNotificationService] Error notifying president of registration:', error);
    }
  }

  /**
   * Internal helper to send registration notification
   */
  private static async sendRegistrationNotification(
    recipientUserId: string,
    registration: NewMemberRegistration,
    wing: string
  ): Promise<void> {
    const supabase = assertSupabase();

    const memberName = `${registration.first_name} ${registration.last_name}`.trim();
    const roleDisplay = registration.requested_role?.replace(/_/g, ' ') || 'member';
    const regionInfo = registration.region_name ? ` (${registration.region_name})` : '';
    const wingLabel = wing === 'main' ? 'organization' : `${wing} wing`;

    await supabase
      .from('push_notifications')
      .insert({
        recipient_user_id: recipientUserId,
        title: '👤 New Member Registration',
        body: `${memberName} has requested to join the ${wingLabel} as ${roleDisplay}${regionInfo}. Tap to review.`,
        notification_type: 'new_member_registration',
        status: 'sent',
        data: {
          type: 'new_member_registration',
          registration_id: registration.id,
          member_name: memberName,
          member_type: registration.member_type,
          requested_role: registration.requested_role,
          region_id: registration.region_id,
          region_name: registration.region_name,
          organization_id: registration.organization_id,
          user_id: registration.user_id,
          action_url: '/screens/membership/pending-approvals',
          channel: 'membership',
          priority: 'high',
        }
      });
  }

  // ============================================================================
  // MEMBER APPROVAL/REJECTION NOTIFICATIONS
  // ============================================================================

  /**
   * Notify member that their registration was approved
   */
  static async notifyMemberApproved(
    userId: string,
    memberName: string,
    organizationName: string,
    memberType: string
  ): Promise<void> {
    try {
      const supabase = assertSupabase();

      const roleDisplay = memberType.replace(/_/g, ' ');

      await supabase
        .from('push_notifications')
        .insert({
          recipient_user_id: userId,
          title: '🎉 Welcome to the Organization!',
          body: `Your membership as ${roleDisplay} at ${organizationName} has been approved. You now have full access.`,
          notification_type: 'membership_approved',
          status: 'sent',
          data: {
            type: 'membership_approved',
            organization_name: organizationName,
            member_type: memberType,
            action_url: '/dashboard',
            channel: 'membership',
            priority: 'high',
            celebration: true,
          }
        });

      console.log(`✅ Notified ${memberName} of membership approval`);
    } catch (error) {
      console.error('[MembershipNotificationService] Error notifying member of approval:', error);
    }
  }

  /**
   * Notify member that their registration was rejected
   */
  static async notifyMemberRejected(
    userId: string,
    memberName: string,
    organizationName: string,
    reason?: string
  ): Promise<void> {
    try {
      const supabase = assertSupabase();

      const reasonText = reason ? ` Reason: ${reason}` : ' Contact the organization for more details.';

      await supabase
        .from('push_notifications')
        .insert({
          recipient_user_id: userId,
          title: '📋 Membership Update',
          body: `Your membership request for ${organizationName} could not be approved.${reasonText}`,
          notification_type: 'membership_rejected',
          status: 'sent',
          data: {
            type: 'membership_rejected',
            organization_name: organizationName,
            rejection_reason: reason,
            action_url: '/support',
            channel: 'membership',
            priority: 'default',
          }
        });

      console.log(`✅ Notified ${memberName} of membership rejection`);
    } catch (error) {
      console.error('[MembershipNotificationService] Error notifying member of rejection:', error);
    }
  }

  // ============================================================================
  // PENDING REMOVAL NOTIFICATIONS
  // ============================================================================

  /**
   * Notify president of pending member removal request
   */
  static async notifyPresidentOfPendingRemoval(
    request: PendingRemovalRequest,
    wing: 'youth' | 'women' | 'veterans' | 'main' = 'youth'
  ): Promise<void> {
    try {
      const supabase = assertSupabase();

      // Determine which president to notify
      const presidentTypes: Record<string, string> = {
        'youth': 'youth_president',
        'women': 'women_president',
        'veterans': 'veterans_president',
        'main': 'president',
      };
      const targetPresidentType = presidentTypes[wing] || 'youth_president';

      // Find the president
      const { data: president, error: presidentError } = await supabase
        .from('organization_members')
        .select('user_id, first_name')
        .eq('organization_id', request.organization_id)
        .eq('member_type', targetPresidentType)
        .eq('membership_status', 'active')
        .maybeSingle();

      if (presidentError || !president) {
        console.warn(`[MembershipNotificationService] No ${targetPresidentType} found for removal notification`);
        return;
      }

      const requestedBy = request.requested_by_name || 'A secretary';
      const regionInfo = request.region_name ? ` from ${request.region_name}` : '';

      await supabase
        .from('push_notifications')
        .insert({
          recipient_user_id: president.user_id,
          title: '⚠️ Member Removal Request',
          body: `${requestedBy} has requested to remove ${request.member_name}${regionInfo}. Your approval is needed.`,
          notification_type: 'pending_removal_request',
          status: 'sent',
          data: {
            type: 'pending_removal_request',
            member_id: request.member_id,
            member_name: request.member_name,
            member_type: request.member_type,
            requested_by_id: request.requested_by_id,
            requested_by_name: request.requested_by_name,
            organization_id: request.organization_id,
            region_name: request.region_name,
            action_url: `/screens/membership/member-detail?id=${request.member_id}`,
            channel: 'membership',
            priority: 'high',
          }
        });

      console.log(`✅ Notified ${targetPresidentType} of pending removal for ${request.member_name}`);
    } catch (error) {
      console.error('[MembershipNotificationService] Error notifying president of pending removal:', error);
    }
  }

  /**
   * Notify secretary that their removal request was approved
   */
  static async notifyRemovalApproved(
    requestedByUserId: string,
    memberName: string,
    approvedByName: string
  ): Promise<void> {
    try {
      const supabase = assertSupabase();

      await supabase
        .from('push_notifications')
        .insert({
          recipient_user_id: requestedByUserId,
          title: '✅ Removal Approved',
          body: `Your request to remove ${memberName} has been approved by ${approvedByName}.`,
          notification_type: 'removal_approved',
          status: 'sent',
          data: {
            type: 'removal_approved',
            member_name: memberName,
            approved_by: approvedByName,
            action_url: '/screens/membership/members-list',
            channel: 'membership',
            priority: 'default',
          }
        });

      console.log(`✅ Notified secretary of approved removal for ${memberName}`);
    } catch (error) {
      console.error('[MembershipNotificationService] Error notifying of removal approval:', error);
    }
  }

  /**
   * Notify secretary that their removal request was rejected
   */
  static async notifyRemovalRejected(
    requestedByUserId: string,
    memberName: string,
    rejectedByName: string,
    reason?: string
  ): Promise<void> {
    try {
      const supabase = assertSupabase();

      const reasonText = reason ? ` Reason: ${reason}` : '';

      await supabase
        .from('push_notifications')
        .insert({
          recipient_user_id: requestedByUserId,
          title: '❌ Removal Denied',
          body: `Your request to remove ${memberName} was not approved.${reasonText}`,
          notification_type: 'removal_rejected',
          status: 'sent',
          data: {
            type: 'removal_rejected',
            member_name: memberName,
            rejected_by: rejectedByName,
            rejection_reason: reason,
            action_url: '/screens/membership/members-list',
            channel: 'membership',
            priority: 'default',
          }
        });

      console.log(`✅ Notified secretary of rejected removal for ${memberName}`);
    } catch (error) {
      console.error('[MembershipNotificationService] Error notifying of removal rejection:', error);
    }
  }
}

export default MembershipNotificationService;
