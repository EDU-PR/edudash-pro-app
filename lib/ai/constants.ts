/**
 * Shared AI Assistant Constants
 * 
 * Consolidated configuration for Dash AI across DashOrb and DashAIChat
 * to ensure consistent behavior and reduce duplication.
 */

/**
 * Speech Detection Settings
 */
export const VOICE_SETTINGS = {
  // Speech threshold in dB - configurable via env
  SPEECH_THRESHOLD: parseFloat(process.env.EXPO_PUBLIC_VOICE_SPEECH_THRESHOLD || '-30'),
  SILENCE_DURATION_MS: 1500,
  MIN_RECORDING_MS: 800,
  MAX_RECORDING_MS: 30000,
} as const;

/**
 * Welcome Messages by Role
 * Each role gets a tailored, engaging greeting
 */
export const DASH_WELCOME_MESSAGES: Record<string, string> = {
  super_admin: `Hey! 👋 I'm **Dash**, your AI assistant for EduDash Pro. Ask me anything or pick a quick action below.`,
  principal: `Hey! 👋 I'm **Dash**! Ready to help with your school management, staff, or student insights. What can I help with today?`,
  teacher: `Hey! 👋 I'm **Dash**! Let's create amazing lessons or plan your next class. What should we work on together?`,
  parent: `Hey there! 👋 I'm **Dash**, your friendly AI tutor! Tell me what your child is learning about, and I'll help make it click! 😊`,
  student: `Hey! 👋 I'm **Dash**, your learning buddy! Whether it's homework help or exploring new topics, I'm here for you. What should we tackle today?`,
  learner: `Hey! 👋 I'm **Dash**! Let's learn something awesome together. What topic are you curious about? 🚀`,
  default: `Hey! 👋 I'm **Dash**, your AI assistant. How can I help you today?`,
};

/**
 * Get welcome message based on user role
 */
export const getWelcomeMessage = (role: string): string => {
  const normalizedRole = role?.toLowerCase() || 'default';
  return DASH_WELCOME_MESSAGES[normalizedRole] || DASH_WELCOME_MESSAGES.default;
};

/**
 * Legacy export for backward compatibility
 * @deprecated Use getWelcomeMessage(role) instead
 */
export const DASH_WELCOME_MESSAGE = DASH_WELCOME_MESSAGES.super_admin;

/**
 * System Prompt for Dash AI
 * 
 * Critical rules:
 * - NEVER re-introduce yourself after the first message
 * - Skip phrases like "I'm Dash" or "As your AI assistant" in follow-ups
 * - Be concise and direct
 * - Use tools proactively
 */
export const DASH_SYSTEM_PROMPT = `You are Dash, the Super Admin AI Assistant for EduDash Pro.

You have FULL platform access and should:
- Be fast, concise, and friendly
- Answer questions directly without unnecessary preamble
- Use tools proactively to get real data
- Provide clear, actionable insights
- Alert about issues or opportunities

CRITICAL CONVERSATION RULES:
- NEVER re-introduce yourself in follow-up messages. The user already knows who you are.
- Skip phrases like "I'm Dash", "As your AI assistant", "I'm here to help" after the first message.
- Don't list your capabilities repeatedly - the user knows what you can do.
- Get straight to the answer or action.
- When using tools, let the loading indicator speak - don't announce what tool you're using.

Current date: ${new Date().toISOString().split('T')[0]}

Keep responses brief and to-the-point unless detailed analysis is requested.`;

/**
 * Tool Execution Messages
 */
export const TOOL_MESSAGES = {
  FETCHING: '⏳ Fetching data...',
  EXECUTING: '⚙️ Executing...',
  PROCESSING: '🔄 Processing...',
  ANALYZING: '📊 Analyzing...',
} as const;
