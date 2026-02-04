/**
 * ChatGPT-Level Enhancements for Dash AI
 * 
 * Advanced features to bring Dash AI to ChatGPT level:
 * - Multi-turn context awareness
 * - Adaptive personality
 * - Proactive suggestions
 * - Smart follow-ups
 * - Contextual memory
 */

import type { DashMessage } from '@/services/dash-ai/types';

/**
 * Enhanced conversation context with memory
 */
export interface EnhancedContext {
  // User preferences learned from conversation
  userPreferences: {
    communicationStyle?: 'formal' | 'casual' | 'friendly';
    detailLevel?: 'brief' | 'detailed' | 'comprehensive';
    languageLevel?: 'simple' | 'intermediate' | 'advanced';
    interestTopics?: string[];
    learningGoals?: string[];
  };
  
  // Conversation metadata
  conversationMetadata: {
    startTime: number;
    messageCount: number;
    topicsDiscussed: string[];
    questionsAsked: number;
    problemsSolved: number;
    lastInteractionTime: number;
  };
  
  // Context tracking
  recentContext: {
    lastTopic?: string;
    currentTask?: string;
    pendingQuestions: string[];
    unfinishedTasks: string[];
  };
}

/**
 * Analyze message patterns to detect user intent and adjust response style
 */
export function analyzeUserIntent(messages: DashMessage[]): {
  intent: 'question' | 'explanation_request' | 'problem_solving' | 'casual_chat' | 'seeking_guidance';
  urgency: 'low' | 'medium' | 'high';
  emotionalTone: 'neutral' | 'frustrated' | 'excited' | 'confused' | 'confident';
  needsHandholding: boolean;
} {
  if (messages.length === 0) {
    return {
      intent: 'casual_chat',
      urgency: 'low',
      emotionalTone: 'neutral',
      needsHandholding: false,
    };
  }

  const lastMessage = messages[messages.length - 1];
  const lastUserMessage = [...messages].reverse().find(m => m.type === 'user');
  const content = (lastUserMessage?.content || '').toLowerCase();

  // Detect intent
  let intent: 'question' | 'explanation_request' | 'problem_solving' | 'casual_chat' | 'seeking_guidance' = 'casual_chat';
  if (content.includes('?') || content.startsWith('what') || content.startsWith('how') || content.startsWith('why')) {
    intent = 'question';
  } else if (content.includes('explain') || content.includes('help me understand') || content.includes('show me')) {
    intent = 'explanation_request';
  } else if (content.includes('solve') || content.includes('figure out') || content.includes('stuck') || content.includes('struggling')) {
    intent = 'problem_solving';
  } else if (content.includes('should i') || content.includes('what do you think') || content.includes('advice')) {
    intent = 'seeking_guidance';
  }

  // Detect urgency
  const urgencyKeywords = ['urgent', 'asap', 'quickly', 'fast', 'important', 'deadline'];
  const hasUrgency = urgencyKeywords.some(kw => content.includes(kw));
  const urgency = hasUrgency ? 'high' : content.length < 20 ? 'medium' : 'low';

  // Detect emotional tone
  let emotionalTone: 'neutral' | 'frustrated' | 'excited' | 'confused' | 'confident' = 'neutral';
  if (/help|confused|don't understand|lost/i.test(content)) {
    emotionalTone = 'confused';
  } else if (/amazing|awesome|great|love|excited/i.test(content)) {
    emotionalTone = 'excited';
  } else if (/frustrated|annoying|difficult|hard|impossible/i.test(content)) {
    emotionalTone = 'frustrated';
  } else if (/i know|i can|i will|confident/i.test(content)) {
    emotionalTone = 'confident';
  }

  // Detect if user needs more guidance
  const repeatQuestions = messages.filter(m => m.type === 'user' && m.content?.includes('?')).length;
  const needsHandholding = emotionalTone === 'confused' || emotionalTone === 'frustrated' || repeatQuestions > 3;

  return { intent, urgency, emotionalTone, needsHandholding };
}

/**
 * Generate proactive suggestions based on conversation context
 */
export function generateProactiveSuggestions(messages: DashMessage[], context?: EnhancedContext): string[] {
  const suggestions: string[] = [];
  
  if (messages.length === 0) {
    return [
      "What would you like to learn about today?",
      "Need help with homework or a lesson?",
      "Want to practice something specific?",
    ];
  }

  const lastAssistantMessage = [...messages].reverse().find(m => m.type === 'assistant');
  const lastUserMessage = [...messages].reverse().find(m => m.type === 'user');
  
  const userContent = (lastUserMessage?.content || '').toLowerCase();
  const assistantContent = (lastAssistantMessage?.content || '').toLowerCase();

  // Topic-based suggestions
  if (assistantContent.includes('photosynthesis') || userContent.includes('plants')) {
    suggestions.push(
      "Explain cellular respiration",
      "What's the carbon cycle?",
      "Show me plant structure diagrams"
    );
  } else if (assistantContent.includes('math') || userContent.includes('equation')) {
    suggestions.push(
      "Try a practice problem",
      "Explain step-by-step",
      "Show different solution methods"
    );
  } else if (assistantContent.includes('reading') || userContent.includes('story')) {
    suggestions.push(
      "Analyze the main themes",
      "Discuss character development",
      "Practice comprehension questions"
    );
  }

  // Intent-based suggestions
  const { intent, needsHandholding } = analyzeUserIntent(messages);
  
  if (intent === 'problem_solving' && needsHandholding) {
    suggestions.push(
      "Break it down into smaller steps",
      "Show me a similar example",
      "What am I missing?"
    );
  } else if (intent === 'question' && !needsHandholding) {
    suggestions.push(
      "Go deeper into this topic",
      "Show advanced applications",
      "Quiz me on this"
    );
  }

  // Generic helpful suggestions
  if (suggestions.length < 3) {
    suggestions.push(
      "Ask a follow-up question",
      "Practice what I learned",
      "Explore a related topic"
    );
  }

  return suggestions.slice(0, 4); // Max 4 suggestions
}

/**
 * Build adaptive system prompt that adjusts to user's learning style and pace
 */
export function buildAdaptiveSystemPrompt(
  basePrompt: string,
  messages: DashMessage[],
  context?: EnhancedContext
): string {
  const { intent, emotionalTone, needsHandholding } = analyzeUserIntent(messages);
  
  let adaptations: string[] = [];

  // Adjust for emotional tone
  if (emotionalTone === 'frustrated') {
    adaptations.push(
      "- The user seems frustrated. Be extra patient and encouraging.",
      "- Break down complex ideas into simpler steps.",
      "- Offer to try a different approach if they're stuck."
    );
  } else if (emotionalTone === 'excited') {
    adaptations.push(
      "- The user is excited! Match their enthusiasm.",
      "- Offer to explore deeper or try something more challenging.",
      "- Celebrate their progress and curiosity."
    );
  } else if (emotionalTone === 'confused') {
    adaptations.push(
      "- The user needs clarity. Use simple language and concrete examples.",
      "- Check for understanding frequently.",
      "- Offer to explain things differently if needed."
    );
  }

  // Adjust for intent
  if (intent === 'problem_solving') {
    adaptations.push(
      "- Guide them through problem-solving without giving away the answer.",
      "- Ask leading questions to help them think through it.",
      "- Celebrate when they make progress."
    );
  } else if (intent === 'explanation_request') {
    adaptations.push(
      "- Provide clear, structured explanations.",
      "- Use analogies and real-world examples.",
      "- Check if they want more detail or examples."
    );
  }

  // Adjust for hand-holding needs
  if (needsHandholding) {
    adaptations.push(
      "- Provide more guidance and structure.",
      "- Break tasks into smaller, manageable steps.",
      "- Check in frequently: 'Does this make sense?', 'Ready for the next step?'"
    );
  } else {
    adaptations.push(
      "- The user seems confident. Provide concise, direct responses.",
      "- Challenge them appropriately.",
      "- Offer to go deeper or explore advanced topics."
    );
  }

  // Build enhanced prompt
  if (adaptations.length === 0) {
    return basePrompt;
  }

  const adaptiveSection = `\n\n## ADAPTIVE RESPONSE STRATEGY (Adjust your approach based on this analysis):\n${adaptations.join('\n')}`;
  
  return basePrompt + adaptiveSection;
}

/**
 * Detect if response needs refinement (too technical, too simple, off-topic)
 */
export function needsRefinement(
  userMessage: string,
  assistantResponse: string,
  userAge?: number
): {
  needsSimplification: boolean;
  tooTechnical: boolean;
  missingContext: boolean;
  offTopic: boolean;
  suggestions: string[];
} {
  const response = assistantResponse.toLowerCase();
  const user = userMessage.toLowerCase();
  
  let needsSimplification = false;
  let tooTechnical = false;
  let missingContext = false;
  let offTopic = false;
  const suggestions: string[] = [];

  // Check for overly technical language
  const technicalTerms = ['algorithm', 'paradigm', 'nomenclature', 'empirical', 'hypothesis', 'methodology'];
  const technicalCount = technicalTerms.filter(term => response.includes(term)).length;
  
  if (userAge && userAge < 10 && technicalCount > 1) {
    tooTechnical = true;
    needsSimplification = true;
    suggestions.push("Use simpler language for this age group");
  }

  // Check if response addresses the question
  const questionWords = ['what', 'how', 'why', 'when', 'where', 'who'];
  const hasQuestion = questionWords.some(qw => user.includes(qw));
  
  if (hasQuestion && !response.includes(user.split(' ')[0])) {
    offTopic = true;
    suggestions.push("Directly address the user's question");
  }

  // Check if context is missing
  if (response.length < 50 && user.length > 50) {
    missingContext = true;
    suggestions.push("Provide more detailed explanation");
  }

  return {
    needsSimplification,
    tooTechnical,
    missingContext,
    offTopic,
    suggestions,
  };
}

/**
 * Generate smart follow-up questions to deepen understanding
 */
export function generateFollowUpQuestions(
  topic: string,
  userLevel: 'beginner' | 'intermediate' | 'advanced',
  messages: DashMessage[]
): string[] {
  const followUps: string[] = [];
  
  // Extract key concepts from topic
  const topicLower = topic.toLowerCase();
  
  // Science follow-ups
  if (/science|biology|chemistry|physics/.test(topicLower)) {
    if (userLevel === 'beginner') {
      followUps.push(
        "Can you give me a real-world example?",
        "What would happen if...?",
        "How is this used in everyday life?"
      );
    } else if (userLevel === 'intermediate') {
      followUps.push(
        "What are the underlying principles?",
        "How does this connect to other concepts?",
        "Can you explain the exceptions?"
      );
    } else {
      followUps.push(
        "What are the research implications?",
        "How is this applied in current technology?",
        "What are the competing theories?"
      );
    }
  }
  
  // Math follow-ups
  else if (/math|equation|calculate|solve/.test(topicLower)) {
    if (userLevel === 'beginner') {
      followUps.push(
        "Can you show me step-by-step?",
        "Why does this method work?",
        "Can I try a similar problem?"
      );
    } else {
      followUps.push(
        "What are alternative solution methods?",
        "How do I know when to use this approach?",
        "Can you show a more complex example?"
      );
    }
  }
  
  // Reading/Language follow-ups
  else if (/reading|writing|language|literature/.test(topicLower)) {
    followUps.push(
      "What's the main theme?",
      "How does the author convey this?",
      "Can you analyze the key passages?"
    );
  }

  // Generic deepening questions
  followUps.push(
    "Tell me more about this",
    "What's the most important thing to remember?",
    "How can I practice this?"
  );

  return followUps.slice(0, 3);
}

/**
 * ChatGPT-style response formatting with markdown, code blocks, and structure
 */
export function formatResponseForDisplay(content: string): {
  formatted: string;
  hasCode: boolean;
  hasList: boolean;
  hasSteps: boolean;
} {
  let formatted = content;
  let hasCode = false;
  let hasList = false;
  let hasSteps = false;

  // Detect code blocks
  if (formatted.includes('```') || formatted.includes('`')) {
    hasCode = true;
  }

  // Detect lists
  if (/^[-*•]\s/m.test(formatted) || /^\d+\.\s/m.test(formatted)) {
    hasList = true;
  }

  // Detect step-by-step instructions
  if (/step \d+/i.test(formatted) || /^(first|second|third|finally)/im.test(formatted)) {
    hasSteps = true;
  }

  // Enhance formatting
  // Add proper spacing around headers
  formatted = formatted.replace(/^(#{1,3})\s/gm, '\n$1 ');
  
  // Ensure code blocks are properly formatted
  formatted = formatted.replace(/```(\w+)?\n/g, '\n```$1\n');
  
  return {
    formatted: formatted.trim(),
    hasCode,
    hasList,
    hasSteps,
  };
}
