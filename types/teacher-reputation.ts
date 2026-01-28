import { z } from 'zod';

const RatingSchema = z.number().min(1).max(5);
const OptionalRatingSchema = RatingSchema.nullable().optional();
const OptionalTrimmedTitleSchema = z.string().trim().max(120).optional();
const OptionalTrimmedCommentSchema = z.string().trim().max(1000).optional();

export const TeacherRatingSummarySchema = z.object({
  candidate_profile_id: z.string().uuid().optional().nullable(),
  teacher_user_id: z.string().uuid().optional().nullable(),
  rating_count: z.number().int().nonnegative(),
  avg_rating: z.number().nullable(),
  avg_communication: z.number().nullable().optional(),
  avg_classroom: z.number().nullable().optional(),
  avg_planning: z.number().nullable().optional(),
  avg_professionalism: z.number().nullable().optional(),
  avg_parent_engagement: z.number().nullable().optional(),
  avg_reliability: z.number().nullable().optional(),
  last_rating_at: z.string().datetime().optional().nullable(),
});

export type TeacherRatingSummary = z.infer<typeof TeacherRatingSummarySchema>;

export const TeacherReferenceRatingsSchema = z.object({
  communication: OptionalRatingSchema,
  classroom: OptionalRatingSchema,
  planning: OptionalRatingSchema,
  professionalism: OptionalRatingSchema,
  parent_engagement: OptionalRatingSchema,
  reliability: OptionalRatingSchema,
});

export type TeacherReferenceRatings = z.infer<typeof TeacherReferenceRatingsSchema>;

export const TeacherReferenceSchema = z.object({
  id: z.string().uuid(),
  candidate_profile_id: z.string().uuid(),
  teacher_user_id: z.string().uuid().optional().nullable(),
  organization_id: z.string().uuid(),
  principal_id: z.string().uuid(),
  rating_overall: RatingSchema,
  title: z.string().trim().max(120).optional().nullable(),
  comment: z.string().trim().max(1000).optional().nullable(),
  is_anonymous: z.boolean(),
  created_at: z.string().datetime(),
  ratings: TeacherReferenceRatingsSchema,
  school_name: z.string().nullable().optional(),
  principal_name: z.string().nullable().optional(),
});

export type TeacherReference = z.infer<typeof TeacherReferenceSchema>;

export const TeacherMarketProfileSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().optional().nullable(),
  email: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  is_public: z.boolean(),
  location: z.string().trim().max(200).optional().nullable(),
  location_city: z.string().trim().max(120).optional().nullable(),
  location_province: z.string().trim().max(120).optional().nullable(),
  location_lat: z.number().min(-90).max(90).optional().nullable(),
  location_lng: z.number().min(-180).max(180).optional().nullable(),
  location_source: z.enum(['gps', 'manual']).optional().nullable(),
  preferred_radius_km: z.number().min(1).max(500).optional().nullable(),
  location_updated_at: z.string().datetime().optional().nullable(),
  preferred_location_lat: z.number().min(-90).max(90).optional().nullable(),
  preferred_location_lng: z.number().min(-180).max(180).optional().nullable(),
  willing_to_commute_km: z.number().min(1).max(500).optional().nullable(),
});

export type TeacherMarketProfile = z.infer<typeof TeacherMarketProfileSchema>;

export const TeacherMarketProfileUpdateSchema = z.object({
  is_public: z.boolean().optional(),
  location: z.string().trim().max(200).optional().nullable(),
  location_city: z.string().trim().max(120).optional().nullable(),
  location_province: z.string().trim().max(120).optional().nullable(),
  location_lat: z.number().min(-90).max(90).optional().nullable(),
  location_lng: z.number().min(-180).max(180).optional().nullable(),
  location_source: z.enum(['gps', 'manual']).optional().nullable(),
  preferred_radius_km: z.number().min(1).max(500).optional().nullable(),
  location_updated_at: z.string().datetime().optional().nullable(),
  preferred_location_lat: z.number().min(-90).max(90).optional().nullable(),
  preferred_location_lng: z.number().min(-180).max(180).optional().nullable(),
  willing_to_commute_km: z.number().min(1).max(500).optional().nullable(),
});

export type TeacherMarketProfileUpdate = z.infer<typeof TeacherMarketProfileUpdateSchema>;

export const CreateTeacherReferenceSchema = z.object({
  candidate_profile_id: z.string().uuid(),
  teacher_user_id: z.string().uuid().optional().nullable(),
  organization_id: z.string().uuid(),
  principal_id: z.string().uuid(),
  rating_overall: RatingSchema,
  ratings: TeacherReferenceRatingsSchema.optional(),
  title: OptionalTrimmedTitleSchema,
  comment: OptionalTrimmedCommentSchema,
  is_anonymous: z.boolean().optional(),
});

export type CreateTeacherReferenceInput = z.infer<typeof CreateTeacherReferenceSchema>;
