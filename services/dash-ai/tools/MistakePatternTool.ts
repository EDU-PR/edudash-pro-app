/**
 * Mistake Pattern Detection Tool
 * 
 * Analyzes conversation history to identify recurring mistakes and learning gaps.
 * Proactively helps students overcome persistent difficulties.
 * 
 * **Features:**
 * - Track recurring errors across sessions
 * - Identify common misconceptions
 * - Detect struggling topics
 * - Generate personalized intervention strategies
 * - Monitor improvement over time
 * 
 * **How it works:**
 * 1. Scans recent conversations for incorrect answers/confusion
 * 2. Groups similar mistakes by topic/concept
 * 3. Detects patterns (e.g., always confuses fractions/decimals)
 * 4. Suggests targeted practice and explanations
 * 
 * **Security:**
 * - Students see their own patterns only
 * - Parents see their children's patterns
 * - Teachers see their students' patterns
 * - Respects RLS policies
 */

import { getDefaultModelIdForTier } from '@/lib/ai/modelForTier';
import { assertSupabase } from '@/lib/supabase';
import { Tool, ToolCategory, RiskLevel, ToolExecutionContext, ToolExecutionResult } from '../types';

export const MistakePatternTool: Tool = {
  id: 'mistake_pattern_detector',
  name: 'Mistake Pattern Detector',
  description: 'Analyzes student conversation history to identify recurring mistakes, learning gaps, and misconceptions. Proactively suggests targeted help when patterns emerge. Helps students overcome persistent difficulties faster.',
  category: 'analysis' as ToolCategory,
  riskLevel: 'low' as RiskLevel,
  
  allowedRoles: ['superadmin', 'principal', 'teacher', 'parent', 'student'],
  requiredTier: 'basic', // Premium feature for pattern analysis
  
  parameters: [
    {
      name: 'action',
      type: 'string',
      description: 'Type of pattern analysis',
      required: true,
      enum: ['detect_patterns', 'get_recommendations', 'track_improvement', 'ai_deep_analysis'],
    },
    {
      name: 'student_id',
      type: 'string',
      description: 'Student ID (optional for students viewing own data)',
      required: false,
    },
    {
      name: 'subject',
      type: 'string',
      description: 'Filter by subject (Mathematics, English, Science, etc.)',
      required: false,
    },
    {
      name: 'days_back',
      type: 'number',
      description: 'Number of days of history to analyze (default: 30, max: 90)',
      required: false,
      validation: {
        min: 1,
        max: 90,
      },
    },
    {
      name: 'min_occurrences',
      type: 'number',
      description: 'Minimum times a mistake must occur to be considered a pattern (default: 3)',
      required: false,
      validation: {
        min: 2,
        max: 10,
      },
    },
  ],

  claudeToolDefinition: {
    name: 'mistake_pattern_detector',
    description: 'Analyzes student conversation history to identify recurring mistakes and learning gaps. Use this when you notice a student repeatedly struggling with the same concept, or to proactively check for patterns. Returns specific mistakes, their frequency, and targeted recommendations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['detect_patterns', 'get_recommendations', 'track_improvement', 'ai_deep_analysis'],
          description: 'detect_patterns: Find recurring mistakes | get_recommendations: Get intervention strategies | track_improvement: Monitor progress over time | ai_deep_analysis: AI-powered deep misconception analysis',
        },
        student_id: {
          type: 'string',
          description: 'Student ID (leave empty for current user)',
        },
        subject: {
          type: 'string',
          description: 'Filter by subject: Mathematics, English, Science, etc.',
        },
        days_back: {
          type: 'number',
          description: 'Days of history to analyze (1-90, default 30)',
        },
        min_occurrences: {
          type: 'number',
          description: 'Minimum repetitions to flag as pattern (2-10, default 3)',
        },
      },
      required: ['action'],
    },
  },

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const client = assertSupabase();
    const { action, student_id, subject, days_back = 30, min_occurrences = 3 } = parameters;

    // Determine target student
    let targetStudentId = student_id;
    if (!targetStudentId && context.role === 'student') {
      targetStudentId = context.userId; // Student viewing own patterns
    }

    if (!targetStudentId) {
      return {
        success: false,
        error: 'Student ID required for this action',
      };
    }

    try {
      switch (action) {
        case 'detect_patterns':
          return await detectPatterns(client, targetStudentId, subject, days_back, min_occurrences);
        
        case 'get_recommendations':
          return await getRecommendations(client, targetStudentId, subject);
        
        case 'track_improvement':
          return await trackImprovement(client, targetStudentId, subject, days_back);

        case 'ai_deep_analysis':
          return await aiDeepAnalysis(client, targetStudentId, subject, days_back, (context as any)?.tier);

        default:
          return {
            success: false,
            error: `Unknown action: ${action}`,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Mistake pattern analysis failed: ${error.message}`,
      };
    }
  },
};

/**
 * Detect recurring mistake patterns from conversation history
 */
async function detectPatterns(
  client: any,
  studentId: string,
  subject: string | undefined,
  daysBack: number,
  minOccurrences: number
): Promise<ToolExecutionResult> {
  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  // Get recent conversations
  let query = client
    .from('dash_conversations')
    .select('id, created_at, metadata')
    .eq('user_id', studentId)
    .gte('created_at', startDate)
    .order('created_at', { ascending: false });

  if (subject) {
    query = query.eq('metadata->>subject', subject);
  }

  const { data: conversations, error: convError } = await query;
  
  if (convError) throw convError;
  if (!conversations || conversations.length === 0) {
    return {
      success: true,
      data: {
        patterns: [],
        message: 'No recent conversation history found',
      },
    };
  }

  // Get messages from these conversations
  const conversationIds = conversations.map((c: any) => c.id);
  const { data: messages, error: msgError } = await client
    .from('dash_messages')
    .select('conversation_id, role, content, metadata, created_at')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: true });

  if (msgError) throw msgError;

  // Analyze messages for mistake patterns
  const patterns = analyzeForMistakes(messages || [], minOccurrences);

  return {
    success: true,
    data: {
      patterns,
      analysis_period: `${daysBack} days`,
      conversations_analyzed: conversations.length,
      messages_analyzed: messages?.length || 0,
      patterns_found: patterns.length,
    },
  };
}

/**
 * Analyze messages to find recurring mistakes
 */
function analyzeForMistakes(messages: any[], minOccurrences: number): any[] {
  const mistakePatterns: Map<string, { count: number; examples: any[]; topic: string }> = new Map();

  // Keywords indicating mistakes/confusion
  const confusionKeywords = [
    'not quite', 'incorrect', 'mistake', 'error', 'confused', 'struggling',
    'let me clarify', 'common misconception', 'careful with', 'don\'t forget',
  ];

  // Scan assistant messages for corrections
  messages
    .filter((m: any) => m.role === 'assistant')
    .forEach((message: any) => {
      const content = message.content?.toLowerCase() || '';
      const hasCorrection = confusionKeywords.some(keyword => content.includes(keyword));

      if (hasCorrection) {
        // Extract topic from metadata or content
        const topic = extractTopic(message);
        const key = topic || 'general';

        if (!mistakePatterns.has(key)) {
          mistakePatterns.set(key, { count: 0, examples: [], topic: key });
        }

        const pattern = mistakePatterns.get(key)!;
        pattern.count++;
        
        if (pattern.examples.length < 5) {
          pattern.examples.push({
            date: message.created_at,
            snippet: message.content.substring(0, 200),
          });
        }
      }
    });

  // Filter to patterns that meet minimum occurrences
  return Array.from(mistakePatterns.values())
    .filter(p => p.count >= minOccurrences)
    .sort((a, b) => b.count - a.count)
    .map(p => ({
      topic: p.topic,
      occurrences: p.count,
      examples: p.examples,
      severity: p.count >= 5 ? 'high' : p.count >= 3 ? 'medium' : 'low',
      recommended_action: p.count >= 5 
        ? 'Urgent: Targeted practice needed' 
        : 'Monitor: Additional support may help',
    }));
}

/**
 * Extract topic/concept from message metadata or content
 */
function extractTopic(message: any): string {
  // Try metadata first
  if (message.metadata?.topic) return message.metadata.topic;
  if (message.metadata?.subject) return message.metadata.subject;

  // Extract from content (simple heuristic)
  const content = message.content || '';
  
  // Common topics
  const topics = [
    'fractions', 'decimals', 'algebra', 'geometry', 'multiplication', 'division',
    'grammar', 'spelling', 'reading comprehension', 'vocabulary',
    'photosynthesis', 'cells', 'energy', 'forces', 'chemical reactions',
  ];

  for (const topic of topics) {
    if (content.toLowerCase().includes(topic)) {
      return topic;
    }
  }

  return 'general';
}

/**
 * Get personalized recommendations based on detected patterns
 */
async function getRecommendations(
  client: any,
  studentId: string,
  subject: string | undefined
): Promise<ToolExecutionResult> {
  // First detect patterns
  const patternsResult = await detectPatterns(client, studentId, subject, 30, 2);
  
  if (!patternsResult.success || !patternsResult.data?.patterns?.length) {
    return {
      success: true,
      data: {
        recommendations: [],
        message: 'No recurring patterns detected. Keep up the good work!',
      },
    };
  }

  const patterns = patternsResult.data.patterns;

  // Generate recommendations for each pattern
  const recommendations = patterns.map((pattern: any) => ({
    topic: pattern.topic,
    issue: `Recurring difficulty with ${pattern.topic} (${pattern.occurrences} times)`,
    severity: pattern.severity,
    strategies: generateStrategies(pattern),
    practice_needed: pattern.occurrences >= 5,
  }));

  return {
    success: true,
    data: {
      recommendations,
      total_patterns: patterns.length,
      high_priority: recommendations.filter((r: any) => r.severity === 'high').length,
    },
  };
}

/**
 * Generate intervention strategies for a pattern
 */
function generateStrategies(pattern: any): string[] {
  const strategies: string[] = [];

  if (pattern.occurrences >= 5) {
    strategies.push('🎯 Focused practice sessions on this specific topic');
    strategies.push('📚 Review foundational concepts - there may be gaps');
    strategies.push('👥 Consider peer tutoring or teacher support');
  } else {
    strategies.push('📖 Review this concept with different examples');
    strategies.push('🔄 Practice with similar problems to build confidence');
  }

  strategies.push('💡 Ask Dash to explain this concept in a different way');
  strategies.push('✍️ Try teaching this concept to someone else');

  return strategies;
}

/**
 * Track improvement over time for specific topics
 */
async function trackImprovement(
  client: any,
  studentId: string,
  subject: string | undefined,
  daysBack: number
): Promise<ToolExecutionResult> {
  // Compare patterns from first half vs second half of period
  const midpoint = Math.floor(daysBack / 2);
  
  const earlyPatterns = await detectPatterns(client, studentId, subject, daysBack, 2);
  const recentPatterns = await detectPatterns(client, studentId, subject, midpoint, 2);

  if (!earlyPatterns.success || !recentPatterns.success) {
    return {
      success: false,
      error: 'Could not analyze improvement trends',
    };
  }

  const earlyTopics = new Set(earlyPatterns.data?.patterns?.map((p: any) => p.topic) || []);
  const recentTopics = new Set(recentPatterns.data?.patterns?.map((p: any) => p.topic) || []);

  const improved = Array.from(earlyTopics).filter(t => !recentTopics.has(t));
  const persistent = Array.from(earlyTopics).filter(t => recentTopics.has(t));
  const newStruggles = Array.from(recentTopics).filter(t => !earlyTopics.has(t));

  return {
    success: true,
    data: {
      analysis_period: `${daysBack} days`,
      improved_topics: improved,
      persistent_difficulties: persistent,
      new_struggles: newStruggles,
      overall_trend: improved.length > persistent.length ? 'improving' : 
                     persistent.length > improved.length ? 'needs_support' : 'stable',
    },
  };
}

/**
 * AI-powered deep misconception analysis.
 * Sends conversation snippets to AI proxy for pedagogical analysis
 * that goes beyond keyword matching.
 */
async function aiDeepAnalysis(
  client: any,
  studentId: string,
  subject: string | undefined,
  daysBack: number,
  tier?: string,
): Promise<ToolExecutionResult> {
  const model = getDefaultModelIdForTier(tier ?? 'free');
  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  // Fetch recent conversations with mistakes
  let query = client
    .from('dash_conversations')
    .select('id, created_at, metadata')
    .eq('user_id', studentId)
    .gte('created_at', startDate)
    .order('created_at', { ascending: false })
    .limit(20);

  if (subject) {
    query = query.eq('metadata->>subject', subject);
  }

  const { data: conversations, error: convError } = await query;
  if (convError) throw convError;
  if (!conversations?.length) {
    return { success: true, data: { patterns: [], message: 'No conversation history found' } };
  }

  const convIds = conversations.map((c: any) => c.id);
  const { data: messages, error: msgError } = await client
    .from('dash_messages')
    .select('conversation_id, role, content, created_at')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: true })
    .limit(200);

  if (msgError) throw msgError;
  if (!messages?.length) {
    return { success: true, data: { patterns: [], message: 'No messages found' } };
  }

  // Build condensed transcript for AI analysis (limit to ~3000 chars)
  const transcript = messages
    .map((m: any) => `[${m.role}]: ${(m.content || '').substring(0, 150)}`)
    .join('\n')
    .substring(0, 3000);

  const prompt = [
    'You are a learning analytics expert analyzing a student\'s conversation history with an AI tutor.',
    `Subject focus: ${subject || 'all subjects'}`,
    `Period: last ${daysBack} days`,
    '',
    'Analyze the following conversation excerpts and identify:',
    '1. Recurring misconceptions (not just wrong answers, but WHY they\'re wrong)',
    '2. Conceptual gaps (prerequisite knowledge that may be missing)',
    '3. Learning style indicators (visual, verbal, kinesthetic preferences)',
    '4. Confidence patterns (where they hesitate vs rush)',
    '',
    'Return JSON:',
    '{',
    '  "misconceptions": [{"concept": "...", "misconception": "...", "frequency": "high|medium|low", "root_cause": "..."}],',
    '  "conceptual_gaps": [{"gap": "...", "prerequisites_needed": ["..."], "impact": "..."}],',
    '  "learning_style": {"primary": "...", "indicators": ["..."]},',
    '  "confidence_map": {"strong_areas": ["..."], "weak_areas": ["..."], "avoidance_topics": ["..."]},',
    '  "intervention_plan": [{"priority": 1, "action": "...", "rationale": "..."}]',
    '}',
    '',
    'Conversation transcript:',
    transcript,
  ].join('\n');

  try {
    const { data: session } = await client.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-proxy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scope: 'teacher',
          service_type: 'grading',
          payload: { prompt, model },
        }),
      },
    );

    if (!response.ok) throw new Error(`AI proxy returned ${response.status}`);
    const result = await response.json();
    const content = result?.content || result?.text || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const analysis = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          data: {
            ...analysis,
            conversations_analyzed: conversations.length,
            messages_analyzed: messages.length,
            analysis_type: 'ai_deep',
          },
          metadata: { toolId: 'mistake_pattern_detector' },
        };
      } catch {
        // fall through
      }
    }

    return {
      success: true,
      data: { raw_analysis: content, analysis_type: 'ai_deep' },
      metadata: { toolId: 'mistake_pattern_detector' },
    };
  } catch (error: any) {
    // Fallback to basic analysis if AI fails
    return detectPatterns(client, studentId, subject, daysBack, 2);
  }
}
