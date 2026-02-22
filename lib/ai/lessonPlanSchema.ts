import { z } from 'zod';

export const LessonPlanStepSchema = z.object({
  title: z.string().min(1),
  minutes: z.number().int().min(1).max(240),
  objective: z.string().min(1),
  teacherPrompt: z.string().min(1),
  example: z.string().min(1),
  instructions: z.array(z.string().min(1)).min(1),
});

export const LessonPlanV2Schema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  objectives: z.array(z.string().min(1)).min(1),
  materials: z.array(z.string().min(1)).min(1),
  steps: z.array(LessonPlanStepSchema).min(1),
  assessment: z.array(z.string().min(1)).min(1),
  differentiation: z.object({
    support: z.string().min(1),
    extension: z.string().min(1),
  }),
  closure: z.string().min(1),
  durationMinutes: z.number().int().min(1).max(480),
  sourceFormat: z.enum(['json', 'markdown_fallback']),
  rawContent: z.string().optional(),
});

export type LessonPlanStep = z.infer<typeof LessonPlanStepSchema>;
export type LessonPlanV2 = z.infer<typeof LessonPlanV2Schema>;

