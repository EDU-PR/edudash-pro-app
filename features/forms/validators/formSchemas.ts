import { z } from 'zod';
import { FIELD_TYPE_VALUES, FORM_AUDIENCE_VALUES, FORM_STATUS_VALUES } from '../types/form.types';

export const FormFieldSchema = z.object({
  id: z.string().min(1),
  type: z.enum(FIELD_TYPE_VALUES),
  label: z.string().min(2),
  required: z.boolean(),
  options: z.array(z.string().min(1)).optional(),
});

export const CreateOrganizationFormSchema = z.object({
  organizationId: z.string().uuid(),
  title: z.string().min(2),
  description: z.string().optional().nullable(),
  audience: z.array(z.enum(FORM_AUDIENCE_VALUES)).min(1),
  fields: z.array(FormFieldSchema).min(1),
  status: z.enum(FORM_STATUS_VALUES),
});

