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
 * Each role gets a tailored greeting and capability list
 */
export const DASH_WELCOME_MESSAGES: Record<string, string> = {
  super_admin: `Hey! 👋 I'm **Dash**, your AI assistant for EduDash Pro.

I can help you with:

📊 **Analytics & Insights**
• Platform statistics and metrics
• User activity analysis
• AI usage tracking
• Revenue and subscription data

🔧 **DevOps Operations**
• Trigger EAS builds (Android/iOS)
• View GitHub commits and PRs
• Monitor build status
• Check deployment pipelines

⚙️ **System Administration**
• Feature flag management
• Send announcements
• Database queries
• Platform configuration

What would you like to do?`,

  principal: `Hey! 👋 I'm **Dash**, your AI assistant.

I can help you with:

📊 **School Analytics**
• Enrollment statistics
• Attendance reports
• Staff performance insights
• Parent engagement metrics

👥 **Staff Management**
• Teacher schedules
• Performance reviews
• Training recommendations

📋 **Administration**
• Generate reports
• Draft communications
• Policy compliance checks

How can I assist you today?`,

  teacher: `Hey! 👋 I'm **Dash**, your teaching assistant.

I can help you with:

📚 **Lesson Planning**
• Generate lesson plans
• Create activities
• Find teaching resources

📝 **Assessment**
• Create quizzes & worksheets
• Grade assignments
• Track student progress

👨‍👩‍👧‍👦 **Student Support**
• Identify struggling learners
• Personalized recommendations
• Parent communication drafts

What would you like help with?`,

  parent: `Hey! 👋 I'm **Dash**, your EduDash assistant.

I can help you with:

📈 **Your Child's Progress**
• View grades and reports
• Track attendance
• See upcoming assignments

📅 **School Activities**
• Check event calendar
• View announcements
• School contact info

💬 **Communication**
• Message teachers
• View report cards
• Get homework help tips

How can I help you today?`,

  student: `Hey! 👋 I'm **Dash**, your study buddy!

I can help you with:

📚 **Learning**
• Explain difficult concepts
• Help with homework
• Study tips & techniques

📅 **Schoolwork**
• View your assignments
• Check your grades
• See your schedule

🎯 **Goals**
• Track your progress
• Set study reminders
• Exam preparation tips

What would you like help with?`,

  learner: `Hey! 👋 I'm **Dash**, your learning companion!

I can help you with:

📚 **Your Courses**
• View program materials
• Track your progress
• Access resources

📝 **Assignments**
• Check due dates
• Get help with submissions
• Review feedback

🎓 **Career Path**
• Portfolio building
• Certification tracking
• Job placement support

How can I assist you today?`,

  default: `Hey! 👋 I'm **Dash**, your AI assistant for EduDash Pro.

I can help you navigate the platform, answer questions, and assist with your tasks.

What would you like help with?`,
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
