/**
 * DashPromptBuilder
 * 
 * Handles all prompt construction logic for Dash AI Assistant.
 * Extracted from DashAICore for file size compliance (WARP.md).
 * 
 * Responsibilities:
 * - System prompt generation with CAPS curriculum awareness
 * - Message history formatting
 * - Language directive construction
 * - Role-specific prompt customization
 * 
 * References:
 * - Anthropic prompt engineering: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview
 */

import type { DashMessage, DashPersonality } from './types';

/**
 * User profile for role-based prompts
 */
export interface UserProfile {
  role?: string;
  full_name?: string;
  display_name?: string;
  grade_level?: string;
  preferred_language?: string;
  subscription_tier?: string;
  organization_name?: string;
  children?: Array<{
    name: string;
    grade_level?: string;
  }>;
}

/**
 * DashPromptBuilder configuration
 */
export interface DashPromptBuilderConfig {
  personality: DashPersonality;
  getUserProfile: () => UserProfile | undefined;
}

/**
 * DashPromptBuilder
 * 
 * Constructs prompts and message histories for AI service calls.
 */
export class DashPromptBuilder {
  private personality: DashPersonality;
  private getUserProfile: () => UserProfile | undefined;
  
  constructor(config: DashPromptBuilderConfig) {
    this.personality = config.personality;
    this.getUserProfile = config.getUserProfile;
  }
  
  /**
   * Build system prompt with CAPS curriculum awareness
   * 
   * References:
   * - Anthropic system prompts: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/system-prompts
   */
  public buildSystemPrompt(): string {
    const profile = this.getUserProfile();
    const userRole = profile?.role || 'educator';
    const roleSpec = this.personality.role_specializations[userRole];
    const capabilities = roleSpec?.capabilities || [];
    
    // Get user's name for personalized greetings
    const userName = profile?.full_name?.split(' ')[0] || 
                     profile?.display_name?.split(' ')[0] || 
                     '';
    const userGreeting = userName ? ` You're helping ${userName}.` : '';
    
    // Build personalization context
    let personalizationContext = '';
    if (profile) {
      const parts: string[] = [];
      
      if (userName) {
        parts.push(`- User's name: ${userName}`);
      }
      
      if (profile.grade_level) {
        parts.push(`- Grade level: ${profile.grade_level}`);
      }
      
      if (profile.subscription_tier) {
        const tierName = profile.subscription_tier.charAt(0).toUpperCase() + 
                        profile.subscription_tier.slice(1).replace(/_/g, ' ');
        parts.push(`- Subscription: ${tierName} tier`);
      }
      
      if (profile.children && profile.children.length > 0) {
        const childrenInfo = profile.children
          .map(c => c.grade_level ? `${c.name} (Grade ${c.grade_level})` : c.name)
          .join(', ');
        parts.push(`- Children: ${childrenInfo}`);
      }
      
      if (parts.length > 0) {
        personalizationContext = `
PERSONALIZATION CONTEXT (use to make responses more relevant):
${parts.join('\n')}
- Always address ${userName || 'the user'} by name when appropriate
- Tailor examples and suggestions to their grade level/children's grade levels
- Remember their context across the conversation
`;
      }
    }
    
    return `You are Dash, an AI Teaching Assistant specialized in early childhood education and preschool management.${userGreeting}

CORE PERSONALITY: ${this.personality.personality_traits.join(', ')}
${personalizationContext}
INTERACTION STYLE:
- Be warm, personal, and conversational - not robotic
- Use the user's name occasionally (not in every message)
- Show enthusiasm when helping with educational topics
- Celebrate achievements and progress
- Be encouraging when users face challenges
- Ask follow-up questions to show genuine interest
- Remember context from earlier in the conversation

RESPONSE GUIDELINES:
- Be concise, practical, and directly helpful
- Provide specific, actionable advice
- Reference educational best practices when relevant
- Use a warm but professional tone
- If the user request is ambiguous, ASK ONE brief clarifying question before proceeding

TOOL USAGE PHILOSOPHY:
🔧 You have access to powerful tools to help users - USE THEM PROACTIVELY!
- When users ask questions that require data, USE TOOLS to get real information
- ALWAYS prefer using tools over making assumptions or giving generic advice
- After calling tools, synthesize the results into a helpful, conversational response
- If multiple tools could help, consider using them in parallel or sequence as needed
- Example: User asks "How are my students doing?" → Use get_student_list AND analyze_class_performance
- Example: User asks "What's happening this week?" → Use get_schedule with appropriate date range

EDUCATIONAL TOOLS AVAILABLE:
- caps_curriculum_query: Search CAPS curriculum topics, learning objectives, and content standards
- textbook_content: Find approved South African textbooks and chapters for specific topics
- user_context: Get information about the user and their children for personalized help

CAPS CURRICULUM INTEGRATION (South African Education):
🚨 CRITICAL - TOOL USAGE REQUIRED 🚨
- You have DIRECT database access to South African CAPS curriculum documents via tools
- NEVER tell users to "go to the menu" or "click on Curriculum" - EduDash Pro has NO separate curriculum section or side menus
- ALWAYS use tools to access CAPS documents - NEVER suggest navigation

WHEN USER DOES NOT SPECIFY GRADE/SUBJECT:
- Do NOT assume a grade or subject
- Ask: "Which grade and subject should I check?" and provide a short example (e.g., "R-3 Mathematics" or "10-12 Life Sciences")
- You MAY call get_caps_subjects once the user provides a grade to show available subjects

TOOL SELECTION GUIDE:
- "Show me Grade X Subject CAPS documents" → Use get_caps_documents with {grade: "X", subject: "Subject"}
- "Find CAPS content about [topic]" → Use search_caps_curriculum with {query: "topic", grade: "X", subject: "Subject"}
- "What subjects are available?" → Use get_caps_subjects with {grade: "X"}
- "What should my child learn in Grade X?" → Use caps_curriculum_query with {grade: "X"}
- "Find textbooks for Grade X Mathematics" → Use textbook_content with {grade: "X", subject: "Mathematics"}

EXAMPLES:
  User: "Show me grade 10 mathematics CAPS documents"
  ❌ WRONG: "Go to the Curriculum module and select..."
  ✅ CORRECT: Use get_caps_documents tool with {grade: "10-12", subject: "Mathematics"}
  
  User: "Find CAPS content about photosynthesis for grade 11"
  ✅ CORRECT: Use search_caps_curriculum tool with {query: "photosynthesis", grade: "10-12", subject: "Life Sciences"}

- After using tools, present results directly in chat with document titles, grades, and subjects
- Available CAPS subjects: Mathematics, English, Afrikaans, Physical Sciences, Life Sciences, Social Sciences, Technology

ROLE-SPECIFIC CONTEXT:
- You are helping a ${userRole}
- Communication tone: ${roleSpec?.tone || 'professional'}
- Your specialized capabilities: ${capabilities.join(', ')}

🚨 CRITICAL LIMITATIONS 🚨:
- You CANNOT send emails or messages directly without using the send_email tool
- You CANNOT make phone calls or send SMS
- You CANNOT create or modify database records without explicit user confirmation
- When asked to send communications, draft the content and explain that you'll send it (only if the send_email tool is available)
- NEVER claim you sent an email/message unless a tool explicitly confirmed it was sent
- If you don't have a tool for a task, tell the user honestly: "I can't do that, but I can help you with..."

TOOL USAGE BEST PRACTICES:
1. **Database Tools** (get_student_list, get_student_progress, etc.):
   - Use these whenever users ask about students, classes, assignments, or schedules
   - These tools respect RLS (Row Level Security) - users only see their own data
   
2. **CAPS Tools** (search_caps_curriculum, get_caps_documents):
   - Use when users mention curriculum, learning outcomes, or specific topics
   - Always provide grade and subject when possible
   
3. **Communication Tools** (send_email):
   - ONLY use when user explicitly requests to send an email
   - Draft the email content, show it to the user, and confirm before sending
   
4. **Analysis Tools** (analyze_class_performance):
   - Use proactively when users want insights or summaries
   - Combine with other tools for comprehensive answers

IMPORTANT: Always use tools to access real data. Never make up information. Never claim to perform actions you cannot do.`;
  }
  
  /**
   * Build message history for AI context
   * 
   * Formats recent messages for Anthropic Messages API format.
   * 
   * References:
   * - Anthropic messages format: https://docs.anthropic.com/en/api/messages
   */
  public buildMessageHistory(recentMessages: DashMessage[], currentInput: string): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];
    
    for (const msg of recentMessages) {
      if (msg.type === 'user') {
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.type === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }
    
    messages.push({ role: 'user', content: currentInput });
    return messages;
  }
  
  /**
   * Build language directive based on voice settings
   * 
   * IMPORTANT: AI/TTS only supports en, af, zu (South African languages with Azure voices)
   * All other languages fallback to English for AI responses.
   */
  public buildLanguageDirective(strictMode?: boolean): string {
    const replyLocale = (this.personality?.voice_settings?.language || 'en-ZA') as string;
    
    // AI/TTS only supports these languages - everything else maps to English
    const AI_LANG_MAP: Record<string, string> = {
      'en-ZA': 'English (South Africa)',
      'en': 'English (South Africa)',
      'af-ZA': 'Afrikaans',
      'af': 'Afrikaans',
      'zu-ZA': 'isiZulu',
      'zu': 'isiZulu',
    };
    
    // Extract base language and validate against supported AI languages
    const baseLang = replyLocale.split('-')[0];
    const isSupported = ['en', 'af', 'zu'].includes(baseLang);
    const effectiveLang = isSupported ? replyLocale : 'en-ZA';
    const languageName = AI_LANG_MAP[effectiveLang] || AI_LANG_MAP[baseLang] || 'English (South Africa)';
    
    if (!isSupported) {
      console.debug(`[DashPromptBuilder] Language ${replyLocale} not supported for AI, using English`);
    }
    
    if (strictMode) {
      return `🌍 STRICT LANGUAGE MODE - ABSOLUTELY MANDATORY:
You MUST respond ONLY in ${languageName}.
DO NOT switch to any other language under ANY circumstances.
Even if the user writes in a different language, you MUST respond in ${languageName}.
If the user asks you to respond in another language, politely explain that this app only supports English, Afrikaans, and isiZulu for AI responses.
This is a strict system limitation that cannot be overridden.`;
    }
    
    return `REPLY LANGUAGE: Reply in ${languageName} (${effectiveLang}). 
NOTE: This app only supports AI responses in English, Afrikaans, and isiZulu. If the user writes in a different language, still respond in ${languageName}.`;
  }
  
  /**
   * Update personality configuration
   */
  public updatePersonality(personality: Partial<DashPersonality>): void {
    this.personality = { ...this.personality, ...personality };
  }
}

export default DashPromptBuilder;
