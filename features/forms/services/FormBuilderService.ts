import { assertSupabase } from '@/lib/supabase';
import { CreateOrganizationFormSchema } from '../validators/formSchemas';
import type { CreateOrganizationFormInput, OrganizationForm } from '../types/form.types';

interface FormPublishNotificationInput {
  organizationId: string;
  formId: string;
  title: string;
  audience: CreateOrganizationFormInput['audience'];
}

export class FormBuilderService {
  static async createForm(input: CreateOrganizationFormInput): Promise<OrganizationForm> {
    const parsed = CreateOrganizationFormSchema.parse(input);
    const supabase = assertSupabase();

    const { data, error } = await supabase
      .from('organization_forms')
      .insert({
        organization_id: parsed.organizationId,
        title: parsed.title,
        description: parsed.description ?? null,
        audience: parsed.audience,
        fields: parsed.fields,
        status: parsed.status,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data as OrganizationForm;
  }

  static async updateForm(formId: string, input: CreateOrganizationFormInput): Promise<OrganizationForm> {
    const parsed = CreateOrganizationFormSchema.parse(input);
    const supabase = assertSupabase();

    const { data, error } = await supabase
      .from('organization_forms')
      .update({
        organization_id: parsed.organizationId,
        title: parsed.title,
        description: parsed.description ?? null,
        audience: parsed.audience,
        fields: parsed.fields,
        status: parsed.status,
      })
      .eq('id', formId)
      .select('*')
      .single();

    if (error) throw error;
    return data as OrganizationForm;
  }

  static async notifyFormPublished(input: FormPublishNotificationInput): Promise<void> {
    const supabase = assertSupabase();
    const { error } = await supabase.functions.invoke('notifications-dispatcher', {
      body: {
        event_type: 'form_published',
        preschool_id: input.organizationId,
        form_id: input.formId,
        form_title: input.title,
        target_audience: input.audience,
        include_email: true,
      },
    });

    if (error) throw error;
  }
}
