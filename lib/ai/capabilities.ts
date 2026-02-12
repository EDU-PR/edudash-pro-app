/**
 * Dash AI Capability System
 * 
 * Tier-based feature flagging system for controlling access to AI features
 * based on user subscription tier.
 * 
 * @module lib/ai/capabilities
 * 
 * Future enhancements:
 * - [ ] Dynamic capability loading from database/remote config
 * - [ ] A/B testing framework integration for gradual rollouts
 * - [ ] Per-user capability overrides for beta testing
 * - [ ] Usage analytics and telemetry per capability
 * - [ ] Capability expiration/time-based access
 * - [ ] Quota tracking per capability (e.g., API calls/month)
 */

import {
  getCapabilityTier,
  normalizeTierName,
  type CapabilityTier,
} from '@/lib/tiers';

/**
 * Available subscription tiers in ascending order of features.
 * Re-exported from the canonical tier system in `@/lib/tiers`.
 */
export type Tier = CapabilityTier;

const TIER_ORDER: Tier[] = ['free', 'starter', 'premium', 'enterprise'];

/**
 * Resolve any product or legacy tier string into capability-tier space.
 * This prevents false feature blocking when callers pass values like
 * "school_pro", "teacher_pro", "parent_plus", or "basic".
 */
export function resolveCapabilityTier(tier: Tier | string | null | undefined): Tier {
  const raw = String(tier || '').trim().toLowerCase();
  if (!raw) return 'free';

  if ((TIER_ORDER as string[]).includes(raw)) {
    return raw as Tier;
  }

  // Legacy billing aliases used in older records/tool contexts.
  if (raw === 'basic' || raw === 'solo' || raw === 'group_5' || raw === 'trialing') {
    return 'starter';
  }
  if (raw === 'pro' || raw === 'group_10') {
    return 'premium';
  }

  try {
    return getCapabilityTier(normalizeTierName(raw));
  } catch {
    // Last-resort fallback for malformed values.
    if (raw.includes('enterprise')) return 'enterprise';
    if (raw.includes('premium') || raw.includes('pro') || raw.includes('plus')) return 'premium';
    if (raw.includes('starter') || raw.includes('basic') || raw.includes('trial')) return 'starter';
    return 'free';
  }
}

/**
 * Granular capability identifiers for feature gating
 * 
 * Naming convention: <domain>.<feature>.<variant>
 * - domain: chat, memory, multimodal, homework, lessons, insights, agent, export, voice, exam, student
 * - feature: specific functionality area
 * - variant: optional specificity (basic, advanced, etc.)
 */
export type DashCapability =
  // Chat capabilities
  | 'chat.basic'                    // Basic text-based chat
  | 'chat.streaming'                // Real-time token streaming
  | 'chat.thinking'                 // Show AI reasoning process
  | 'chat.priority'                 // Priority queue processing
  | 'chat.contextual'               // Context-aware responses based on user role/data
  
  // Memory capabilities
  | 'memory.lite'                   // 7-day conversation history
  | 'memory.standard'               // 30-day conversation history
  | 'memory.advanced'               // Unlimited history + behavioral learning
  | 'memory.patterns'               // Cross-session pattern detection
  | 'memory.semantic'               // Semantic search across conversations
  
  // Multimodal capabilities
  | 'multimodal.vision'             // Image analysis and understanding
  | 'multimodal.image_generation'   // AI image generation
  | 'multimodal.ocr'                // Optical character recognition
  | 'multimodal.documents'          // PDF/DOCX processing
  | 'multimodal.handwriting'        // Handwriting recognition
  | 'multimodal.audio'              // Audio file processing
  | 'multimodal.diagrams'           // Diagram/chart analysis
  
  // Voice capabilities (NEW)
  | 'voice.input'                   // Speech-to-text input
  | 'voice.output'                  // Text-to-speech output
  | 'voice.realtime'                // Real-time voice conversation
  | 'voice.multilingual'            // Multi-language voice support (11 SA languages)
  
  // Homework capabilities
  | 'homework.assign'               // Create and assign homework
  | 'homework.grade.basic'          // Basic objective grading (math, MC)
  | 'homework.grade.advanced'       // Advanced subjective grading (essays)
  | 'homework.grade.bulk'           // Batch grading for 100+ submissions
  | 'homework.rubric'               // Auto-generate grading rubrics
  | 'homework.feedback'             // Personalized feedback generation
  | 'homework.plagiarism'           // Plagiarism detection
  
  // Lesson capabilities
  | 'lessons.basic'                 // Basic lesson help and guidance
  | 'lessons.curriculum'            // Curriculum-aligned lesson plans
  | 'lessons.adaptive'              // Step-by-step adaptive lessons
  | 'lessons.trends'                // Trend-based lesson generation
  | 'lessons.personalized'          // Student-specific customization
  | 'lessons.interactive'           // Interactive lesson elements (quizzes, activities)
  | 'lessons.multimedia'            // Generate lessons with multimedia content
  
  // Exam Prep capabilities (NEW)
  | 'exam.practice'                 // Generate practice tests
  | 'exam.revision'                 // Create revision materials
  | 'exam.flashcards'               // Generate flashcards
  | 'exam.studyguide'               // Create study guides
  | 'exam.pastpapers'               // Access past papers database
  | 'exam.marking'                  // Auto-mark exam responses
  | 'exam.interactive'              // Interactive exam experience
  
  // Student capabilities (NEW - for K-12 students)
  | 'student.tutor'                 // AI tutoring sessions
  | 'student.explain'               // Explain concepts step-by-step
  | 'student.practice'              // Practice problems with hints
  | 'student.progress'              // Track learning progress
  | 'student.goals'                 // Set and track learning goals
  
  // Insights & Analytics
  | 'insights.basic'                // Basic statistics and metrics
  | 'insights.proactive'            // Daily briefings and suggestions
  | 'insights.predictive'           // Predictive analytics and forecasts
  | 'insights.custom'               // Custom report generation
  | 'insights.realtime'             // Real-time activity monitoring
  | 'insights.learning'             // Learning analytics per student
  
  // Agent capabilities
  | 'agent.workflows'               // Multi-step task workflows
  | 'agent.autonomous'              // Autonomous task planning
  | 'agent.background'              // Background task processing
  | 'agent.scheduling'              // Automated scheduling
  | 'agent.notifications'           // AI-triggered notifications
  | 'agent.tools'                   // Access to agentic tools (DB queries, etc.)
  
  // Export capabilities
  | 'export.pdf.basic'              // Basic PDF generation
  | 'export.pdf.advanced'           // Advanced templates with branding
  | 'export.pdf.bulk'               // Batch PDF generation
  | 'export.conversation'           // Export conversation history
  | 'export.reports'                // Export analytics reports
  
  // Processing capabilities
  | 'processing.priority'           // Priority queue access
  | 'processing.background'         // Background job processing
  | 'processing.batch';             // Batch operations

/**
 * Tier capability matrix - defines which capabilities are available per tier
 * 
 * Organized by tier in ascending order, with each tier inheriting all
 * capabilities from lower tiers plus its own additions.
 */
export const CAPABILITY_MATRIX: Readonly<Record<Tier, readonly DashCapability[]>> = {
  free: [
    // Chat
    'chat.basic',
    // Memory
    'memory.lite',
    // Multimodal (limited via daily budget)
    'multimodal.vision',
    'multimodal.image_generation',
    // Voice (limited)
    'voice.input',
    'voice.output',
    // Lessons
    'lessons.basic',
    // Exam prep teaser only (full exam prep starts at Starter tier)
    'exam.flashcards',
    // Student features
    'student.tutor',
    'student.explain',
    // Insights
    'insights.basic',
  ],
  
  starter: [
    // Chat
    'chat.basic',
    'chat.streaming',
    'chat.contextual',
    // Memory
    'memory.lite',
    'memory.standard',
    // Multimodal
    'multimodal.vision',
    'multimodal.image_generation',
    'multimodal.documents',
    // Voice
    'voice.input',
    'voice.output',
    'voice.multilingual',
    // Homework
    'homework.assign',
    'homework.grade.basic',
    'homework.feedback',
    // Lessons
    'lessons.basic',
    'lessons.curriculum',
    'lessons.interactive',
    // Exam prep
    'exam.practice',
    'exam.revision',
    'exam.flashcards',
    'exam.studyguide',
    'exam.interactive',
    // Student features
    'student.tutor',
    'student.explain',
    'student.practice',
    'student.progress',
    // Insights
    'insights.basic',
    // Agent (limited)
    'agent.tools',
    // Export
    'export.pdf.basic',
    'export.conversation',
  ],
  
  premium: [
    // Chat
    'chat.basic',
    'chat.streaming',
    'chat.thinking',
    'chat.priority',
    'chat.contextual',
    // Memory
    'memory.standard',
    'memory.advanced',
    'memory.patterns',
    'memory.semantic',
    // Multimodal
    'multimodal.vision',
    'multimodal.image_generation',
    'multimodal.ocr',
    'multimodal.documents',
    'multimodal.handwriting',
    'multimodal.audio',
    'multimodal.diagrams',
    // Voice
    'voice.input',
    'voice.output',
    'voice.realtime',
    'voice.multilingual',
    // Homework
    'homework.assign',
    'homework.grade.basic',
    'homework.grade.advanced',
    'homework.grade.bulk',
    'homework.rubric',
    'homework.feedback',
    'homework.plagiarism',
    // Lessons
    'lessons.basic',
    'lessons.curriculum',
    'lessons.adaptive',
    'lessons.trends',
    'lessons.personalized',
    'lessons.interactive',
    'lessons.multimedia',
    // Exam prep
    'exam.practice',
    'exam.revision',
    'exam.flashcards',
    'exam.studyguide',
    'exam.pastpapers',
    'exam.marking',
    'exam.interactive',
    // Student features
    'student.tutor',
    'student.explain',
    'student.practice',
    'student.progress',
    'student.goals',
    // Insights
    'insights.basic',
    'insights.proactive',
    'insights.predictive',
    'insights.realtime',
    'insights.learning',
    // Agent
    'agent.workflows',
    'agent.autonomous',
    'agent.background',
    'agent.scheduling',
    'agent.notifications',
    'agent.tools',
    // Export
    'export.pdf.basic',
    'export.pdf.advanced',
    'export.pdf.bulk',
    'export.conversation',
    'export.reports',
    // Processing
    'processing.priority',
    'processing.background',
    'processing.batch',
  ],
  
  enterprise: [
    // Chat - All capabilities
    'chat.basic',
    'chat.streaming',
    'chat.thinking',
    'chat.priority',
    'chat.contextual',
    // Memory - All capabilities
    'memory.standard',
    'memory.advanced',
    'memory.patterns',
    'memory.semantic',
    // Multimodal - All capabilities
    'multimodal.vision',
    'multimodal.image_generation',
    'multimodal.ocr',
    'multimodal.documents',
    'multimodal.handwriting',
    'multimodal.audio',
    'multimodal.diagrams',
    // Voice - All capabilities
    'voice.input',
    'voice.output',
    'voice.realtime',
    'voice.multilingual',
    // Homework - All capabilities
    'homework.assign',
    'homework.grade.basic',
    'homework.grade.advanced',
    'homework.grade.bulk',
    'homework.rubric',
    'homework.feedback',
    'homework.plagiarism',
    // Lessons - All capabilities
    'lessons.basic',
    'lessons.curriculum',
    'lessons.adaptive',
    'lessons.trends',
    'lessons.personalized',
    'lessons.interactive',
    'lessons.multimedia',
    // Exam prep - All capabilities
    'exam.practice',
    'exam.revision',
    'exam.flashcards',
    'exam.studyguide',
    'exam.pastpapers',
    'exam.marking',
    'exam.interactive',
    // Student features - All capabilities
    'student.tutor',
    'student.explain',
    'student.practice',
    'student.progress',
    'student.goals',
    // Insights - All capabilities including custom
    'insights.basic',
    'insights.proactive',
    'insights.predictive',
    'insights.custom',
    'insights.realtime',
    'insights.learning',
    // Agent - All capabilities
    'agent.workflows',
    'agent.autonomous',
    'agent.background',
    'agent.scheduling',
    'agent.notifications',
    'agent.tools',
    // Export - All capabilities
    'export.pdf.basic',
    'export.pdf.advanced',
    'export.pdf.bulk',
    'export.conversation',
    'export.reports',
    // Processing - All capabilities
    'processing.priority',
    'processing.background',
    'processing.batch',
  ],
} as const;

/**
 * Capability metadata for display and documentation
 */
export interface CapabilityMetadata {
  id: DashCapability;
  name: string;
  description: string;
  requiredTier: Tier;
  category: 'chat' | 'memory' | 'multimodal' | 'voice' | 'homework' | 'lessons' | 'exam' | 'student' | 'insights' | 'agent' | 'export' | 'processing';
}

/**
 * Check if a specific capability is available for a given tier
 * 
 * @param tier - User's subscription tier
 * @param capability - Capability to check
 * @returns True if capability is available for the tier
 * 
 * @example
 * ```typescript
 * if (hasCapability('premium', 'multimodal.vision')) {
 *   // User can analyze images
 * }
 * ```
 */
export function hasCapability(tier: Tier | string, capability: DashCapability): boolean {
  const resolvedTier = resolveCapabilityTier(tier);
  const capabilities = CAPABILITY_MATRIX[resolvedTier];
  if (!capabilities) return false;
  return capabilities.includes(capability);
}

/**
 * Get all available capabilities for a given tier
 * 
 * @param tier - User's subscription tier
 * @returns Array of available capabilities
 * 
 * @example
 * ```typescript
 * const capabilities = getCapabilities('starter');
 * console.log(capabilities); // ['chat.basic', 'chat.streaming', ...]
 * ```
 */
export function getCapabilities(tier: Tier | string): readonly DashCapability[] {
  const resolvedTier = resolveCapabilityTier(tier);
  return CAPABILITY_MATRIX[resolvedTier] || [];
}

/**
 * Get the minimum required tier for a capability
 * 
 * @param capability - Capability to check
 * @returns Minimum tier that has this capability, or null if not found
 * 
 * @example
 * ```typescript
 * const minTier = getRequiredTier('multimodal.vision');
 * console.log(minTier); // 'premium'
 * ```
 * 
 * Future enhancements:
 * - [ ] Cache results for performance
 * - [ ] Return tier display name instead of identifier
 */
export function getRequiredTier(capability: DashCapability): Tier | null {
  const tiers: Tier[] = ['free', 'starter', 'premium', 'enterprise'];
  
  for (const tier of tiers) {
    if (hasCapability(tier, capability)) {
      return tier;
    }
  }
  
  return null;
}

/**
 * Get capabilities unique to a tier (not available in lower tiers)
 * 
 * @param tier - Target tier
 * @returns Capabilities exclusive to this tier
 * 
 * @example
 * ```typescript
 * const exclusiveFeatures = getExclusiveCapabilities('premium');
 * // Returns capabilities only available in premium, not in basic
 * ```
 */
export function getExclusiveCapabilities(tier: Tier): DashCapability[] {
  const tiers: Tier[] = ['free', 'starter', 'premium', 'enterprise'];
  const tierIndex = tiers.indexOf(tier);
  
  if (tierIndex === 0) {
    return [...CAPABILITY_MATRIX[tier]];
  }
  
  const lowerTier = tiers[tierIndex - 1];
  const currentCapabilities = new Set(CAPABILITY_MATRIX[tier]);
  const lowerCapabilities = new Set(CAPABILITY_MATRIX[lowerTier]);
  
  return Array.from(currentCapabilities).filter(cap => !lowerCapabilities.has(cap));
}

/**
 * Compare two tiers
 * 
 * @param tier1 - First tier
 * @param tier2 - Second tier
 * @returns Negative if tier1 < tier2, 0 if equal, positive if tier1 > tier2
 * 
 * @example
 * ```typescript
 * if (compareTiers('premium', 'starter') > 0) {
 *   console.log('Premium is higher than starter');
 * }
 * ```
 */
export function compareTiers(tier1: Tier | string, tier2: Tier | string): number {
  const resolvedTier1 = resolveCapabilityTier(tier1);
  const resolvedTier2 = resolveCapabilityTier(tier2);
  return TIER_ORDER.indexOf(resolvedTier1) - TIER_ORDER.indexOf(resolvedTier2);
}

/**
 * Feature gating error thrown when user attempts to use unavailable capability
 * 
 * @example
 * ```typescript
 * throw new FeatureGatedError(
 *   'Image analysis requires Premium subscription',
 *   'multimodal.vision',
 *   'premium'
 * );
 * ```
 */
export class FeatureGatedError extends Error {
  public readonly capability: DashCapability;
  public readonly requiredTier: Tier;
  public readonly currentTier?: Tier;

  constructor(
    message: string,
    capability: DashCapability,
    requiredTier: Tier,
    currentTier?: Tier
  ) {
    super(message);
    this.name = 'FeatureGatedError';
    this.capability = capability;
    this.requiredTier = requiredTier;
    this.currentTier = currentTier;
    
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FeatureGatedError);
    }
  }

  /**
   * Get user-friendly error message for display
   */
  public getUserMessage(): string {
    const tierDisplay = this.requiredTier.charAt(0).toUpperCase() + this.requiredTier.slice(1);
    return `This feature requires ${tierDisplay} subscription. Upgrade to unlock!`;
  }
}

/**
 * Helper to assert a capability is available, throwing if not
 * 
 * @param tier - User's current tier
 * @param capability - Required capability
 * @param customMessage - Optional custom error message
 * @throws {FeatureGatedError} If capability is not available
 * 
 * @example
 * ```typescript
 * assertCapability(userTier, 'multimodal.vision');
 * // If user doesn't have vision capability, throws FeatureGatedError
 * ```
 */
export function assertCapability(
  tier: Tier | string,
  capability: DashCapability,
  customMessage?: string
): void {
  const resolvedTier = resolveCapabilityTier(tier);

  if (!hasCapability(resolvedTier, capability)) {
    const requiredTier = getRequiredTier(capability);
    const message = customMessage || 
      `Feature '${capability}' requires ${requiredTier} tier or higher`;
    
    throw new FeatureGatedError(
      message,
      capability,
      requiredTier || 'premium',
      resolvedTier
    );
  }
}

/**
 * Batch check multiple capabilities
 * 
 * @param tier - User's tier
 * @param capabilities - Capabilities to check
 * @returns Object mapping capability to availability
 * 
 * @example
 * ```typescript
 * const access = checkCapabilities('starter', [
 *   'chat.streaming',
 *   'multimodal.vision'
 * ]);
 * // { 'chat.streaming': true, 'multimodal.vision': true }
 * ```
 */
export function checkCapabilities(
  tier: Tier | string,
  capabilities: DashCapability[]
): Record<string, boolean> {
  return capabilities.reduce((acc, capability) => {
    acc[capability] = hasCapability(tier, capability);
    return acc;
  }, {} as Record<string, boolean>);
}

/**
 * Get tier display information
 * 
 * @param tier - Tier to get info for
 * @returns Display information for the tier
 */
export function getTierInfo(tier: Tier | string): {
  id: Tier;
  name: string;
  color: string;
  order: number;
} {
  const resolvedTier = resolveCapabilityTier(tier);
  const tiers = {
    free: { name: 'Free', color: '#8E8E93', order: 0 },
    starter: { name: 'Starter', color: '#34C759', order: 1 },
    premium: { name: 'Premium', color: '#FF9500', order: 2 },
    enterprise: { name: 'Enterprise', color: '#007AFF', order: 3 },
  };

  const fallback = tiers.free;
  const info = tiers[resolvedTier] || fallback;
  return { id: (tiers[resolvedTier] ? resolvedTier : 'free'), ...info };
}
