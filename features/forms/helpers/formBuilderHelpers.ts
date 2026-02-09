/**
 * Form Builder helpers — constants, templates, derived suggestions, and progress hook.
 * Extracted from principal-form-builder.tsx for WARP.md compliance.
 */
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { FIELD_TYPE_VALUES } from '@/features/forms/types/form.types';
import type { FieldType, FormAudience, FormField } from '@/features/forms/types/form.types';

type IoniconName = keyof typeof Ionicons.glyphMap;

/** Step displayed in the progress indicator during save/publish */
export type ProgressStep = {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done';
};

/** Palette of field types available in the form builder */
export const FIELD_TYPES: Array<{ id: FieldType; label: string; icon: IoniconName }> = [
  { id: 'short_text', label: 'Short Text', icon: 'text' },
  { id: 'long_text', label: 'Long Text', icon: 'document-text' },
  { id: 'number', label: 'Number', icon: 'calculator' },
  { id: 'date', label: 'Date', icon: 'calendar' },
  { id: 'dropdown', label: 'Dropdown', icon: 'list' },
  { id: 'multi_select', label: 'Multi‑select', icon: 'options' },
  { id: 'file', label: 'File Upload', icon: 'cloud-upload' },
  { id: 'consent', label: 'Consent', icon: 'checkbox' },
  { id: 'fee_item', label: 'Fee Item', icon: 'wallet' },
];

/** Create a new form field with a unique random ID */
export const createField = (
  label: string,
  type: FieldType,
  required = false,
  options?: string[],
): FormField => ({
  id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  type,
  label,
  required,
  options,
});

/** Zod schema for validating the form before save/publish */
export const FormSchema = z.object({
  title: z.string().min(2, 'Add a form title.'),
  fields: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().min(2, 'Each field needs a label.'),
        type: z.enum(FIELD_TYPE_VALUES),
        required: z.boolean(),
        options: z.array(z.string()).optional(),
      }),
    )
    .min(1, 'Add at least one field.'),
});

// ---------------------------------------------------------------------------
// Template & suggestion factories
// ---------------------------------------------------------------------------

/** Built-in form templates keyed to organisation terminology */
export function getFormTemplates(terminology: { guardians: string; instructors: string }) {
  return [
    {
      id: 'my_school_1_3',
      title: 'My School \u2022 Discovery Activity (Ages 1\u20133)',
      description:
        'Plan a simple discovery activity around the school theme with quick observation-based assessment.',
      audience: ['teachers'] as FormAudience[],
      fields: [
        createField('Age group', 'dropdown', true, ['1-2', '2-3']),
        createField('Learning goal', 'short_text', true),
        createField('Materials needed', 'long_text'),
        createField('Activity steps', 'long_text', true),
        createField('Observation rubric', 'dropdown', true, [
          'Participation',
          'Following instructions',
          'Motor skills',
          'Social interaction',
        ]),
        createField('Photo / video evidence', 'file'),
        createField('Homework included?', 'dropdown', false, ['No', 'Yes']),
        createField('Parent note (optional)', 'long_text'),
      ],
    },
    {
      id: 'my_school_4_6',
      title: 'My School \u2022 Explorer Activity (Ages 4\u20136)',
      description:
        'Create a structured lesson/homework plan with reflection prompts and optional homework.',
      audience: ['teachers'] as FormAudience[],
      fields: [
        createField('Age group', 'dropdown', true, ['4-5', '5-6']),
        createField('Learning goal', 'short_text', true),
        createField('Warm-up prompt', 'long_text'),
        createField('Activity steps', 'long_text', true),
        createField('Assessment rubric', 'dropdown', true, [
          'Understanding',
          'Creativity',
          'Completion',
          'Collaboration',
        ]),
        createField('Homework included?', 'dropdown', false, ['No', 'Yes']),
        createField('Homework instructions', 'long_text'),
        createField('Evidence upload', 'file'),
      ],
    },
    {
      id: 'excursion',
      title: 'Excursion Consent',
      description: 'Capture consent, allergies, emergency contact details, and payment.',
      audience: ['parents'] as FormAudience[],
      fields: [
        createField('Excursion date', 'date', true),
        createField('Emergency contact', 'short_text', true),
        createField('Allergies / medical notes', 'long_text'),
        createField('Consent approval', 'consent', true),
        createField('Excursion fee', 'fee_item'),
      ],
    },
    {
      id: 'parent_workshop',
      title: `${terminology.guardians} Workshop RSVP`,
      description: 'Plan a workshop and capture attendance preferences and questions.',
      audience: ['parents'] as FormAudience[],
      fields: [
        createField('Workshop date', 'date', true),
        createField('Number of attendees', 'number', true),
        createField('Topics you want covered', 'multi_select', false, [
          'Behaviour',
          'Literacy',
          'Numeracy',
          'Other',
        ]),
        createField('Questions for the facilitator', 'long_text'),
      ],
    },
    {
      id: 'staff_training',
      title: `${terminology.instructors} Training RSVP`,
      description: 'Collect training attendance, feedback, and availability.',
      audience: ['teachers', 'staff'] as FormAudience[],
      fields: [
        createField('Training date', 'date', true),
        createField('Preferred session', 'dropdown', true, ['Morning', 'Afternoon']),
        createField('Questions or focus areas', 'long_text'),
      ],
    },
  ];
}

/** Derive smart field suggestions from the form title and description */
export function getSuggestedFields(title: string, description: string): FormField[] {
  const text = `${title} ${description}`.toLowerCase();
  const suggestions: FormField[] = [];

  if (text.includes('excursion') || text.includes('trip')) {
    suggestions.push(createField('Emergency contact', 'short_text', true));
    suggestions.push(createField('Consent approval', 'consent', true));
    suggestions.push(createField('Excursion fee', 'fee_item'));
  }
  if (text.includes('workshop') || text.includes('meeting')) {
    suggestions.push(
      createField('Preferred time', 'dropdown', true, ['Morning', 'Afternoon', 'Evening']),
    );
    suggestions.push(createField('Questions for the host', 'long_text'));
  }
  if (text.includes('uniform')) {
    suggestions.push(
      createField('Uniform size', 'dropdown', true, ['XS', 'S', 'M', 'L', 'XL']),
    );
    suggestions.push(createField('Uniform quantity', 'number'));
  }

  return suggestions;
}

/** Real-time health insights about the current form configuration */
export function getFormInsights(
  fields: FormField[],
  description: string,
  audienceCount: number,
): string[] {
  const notes: string[] = [];

  if (fields.length === 0) {
    notes.push('Add at least one field so people know what to respond to.');
  }
  if (fields.length > 0 && !fields.some((f) => f.required)) {
    notes.push('Mark at least one field as required to prevent empty submissions.');
  }
  if (description.toLowerCase().includes('fee') && !fields.some((f) => f.type === 'fee_item')) {
    notes.push('Consider adding a Fee Item field to capture payment details.');
  }
  if (audienceCount === 0) {
    notes.push('Select at least one audience so we know who should receive the form.');
  }

  return notes;
}

// ---------------------------------------------------------------------------
// Progress-step state machine (used during save / publish)
// ---------------------------------------------------------------------------

const INITIAL_STEPS: ProgressStep[] = [
  { id: 'validate', label: 'Validating form', status: 'active' },
  { id: 'save', label: 'Saving draft', status: 'pending' },
  { id: 'notify', label: 'Preparing notifications', status: 'pending' },
];

/** Manages the animated progress stepper shown while persisting a form. */
export function useFormProgress() {
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const start = () => {
    setProgressSteps(INITIAL_STEPS);
    timerRef.current = setInterval(() => {
      setProgressSteps((prev) => {
        const next = [...prev];
        const idx = next.findIndex((s) => s.status === 'active');
        if (idx === -1) return next;
        next[idx] = { ...next[idx], status: 'done' };
        if (idx + 1 < next.length) next[idx + 1] = { ...next[idx + 1], status: 'active' };
        return next;
      });
    }, 1800);
  };

  const markAllDone = () =>
    setProgressSteps((prev) => prev.map((s) => ({ ...s, status: 'done' as const })));

  useEffect(() => () => stop(), []);

  return { progressSteps, startProgress: start, stopProgress: stop, markAllDone };
}
