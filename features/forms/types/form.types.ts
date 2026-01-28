export const FIELD_TYPE_VALUES = [
  'short_text',
  'long_text',
  'number',
  'date',
  'dropdown',
  'multi_select',
  'file',
  'consent',
  'fee_item',
] as const;

export type FieldType = typeof FIELD_TYPE_VALUES[number];

export const FORM_AUDIENCE_VALUES = ['parents', 'teachers', 'staff'] as const;
export type FormAudience = typeof FORM_AUDIENCE_VALUES[number];

export const FORM_STATUS_VALUES = ['draft', 'published', 'archived'] as const;
export type FormStatus = typeof FORM_STATUS_VALUES[number];

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  options?: string[];
}

export interface OrganizationForm {
  id: string;
  organization_id: string;
  title: string;
  description?: string | null;
  audience: FormAudience[];
  fields: FormField[];
  status: FormStatus;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
}

export interface CreateOrganizationFormInput {
  organizationId: string;
  title: string;
  description?: string | null;
  audience: FormAudience[];
  fields: FormField[];
  status: FormStatus;
}

