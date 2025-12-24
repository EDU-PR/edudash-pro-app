/**
 * ID Card Types
 * Shared types for ID card components
 */
import type { OrganizationMember, MemberIDCard, CardTemplate } from '@/components/membership/types';

export interface IDCardScreenProps {
  memberId?: string;
}

export interface IDCardActionsProps {
  member: OrganizationMember;
  card: MemberIDCard;
  template: CardTemplate;
  theme: any;
  onPrint: () => void;
  onSavePDF: () => void;
  onShare: () => void;
  isGeneratingPDF: boolean;
}

export interface TemplateSelectorProps {
  selectedTemplate: CardTemplate;
  onSelectTemplate: (template: CardTemplate) => void;
  theme: any;
}

export interface CardPreviewProps {
  member: OrganizationMember;
  card: MemberIDCard;
  template: CardTemplate;
  theme: any;
  onFlip: () => void;
  isFlipped: boolean;
}
