/**
 * Smart Reply Suggestions Hook (M12)
 *
 * Generates contextual quick-reply suggestions based on the last received
 * message. Uses local pattern matching only — no AI call — for instant UX.
 */

import { useMemo } from 'react';

interface SmartReplyInput {
  content: string;
  senderRole?: string;
}

interface UseSmartRepliesReturn {
  suggestions: string[];
  loading: boolean;
}

export function useSmartReplies(lastMessage?: SmartReplyInput): UseSmartRepliesReturn {
  const suggestions = useMemo(() => {
    if (!lastMessage?.content) return [];

    return generateReplies(lastMessage.content, lastMessage.senderRole);
  }, [lastMessage?.content, lastMessage?.senderRole]);

  return { suggestions, loading: false };
}

function generateReplies(content: string, senderRole?: string): string[] {
  const lower = content.toLowerCase().trim();

  // Thank you messages
  if (/\b(thank|thanks|thx|appreciate)\b/i.test(lower)) {
    return ["You're welcome!", 'No problem!', 'Happy to help'];
  }

  // Fee / payment questions
  if (/\b(fee|fees|payment|invoice|balance|amount due|outstanding)\b/i.test(lower)) {
    return ["I'll check and get back to you", 'Can you send the details?', 'When is it due?'];
  }

  // Schedule / meeting questions
  if (/\b(schedule|meeting|appointment|available|reschedule|time|slot)\b/i.test(lower)) {
    return ['That works for me', 'Can we reschedule?', "I'll confirm later"];
  }

  // Greetings
  if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|howzit|molo)\b/i.test(lower)) {
    return ['Good morning!', 'Hi! How can I help?', 'Hello!'];
  }

  // Homework / assignment related
  if (/\b(homework|assignment|worksheet|project|task|due date|submission)\b/i.test(lower)) {
    return ['My child will complete it tonight', 'Can I get an extension?', 'Thank you for the update'];
  }

  // Absence / sick
  if (/\b(absent|sick|ill|not feeling well|won't be|cannot attend|leave)\b/i.test(lower)) {
    return ['I hope they feel better soon!', 'Thanks for letting me know', "I'll send the work they missed"];
  }

  // Event / reminder
  if (/\b(event|concert|sports day|field trip|reminder|function|excursion)\b/i.test(lower)) {
    return ['Thanks for the reminder!', "We'll be there!", 'What should we bring?'];
  }

  // Report / progress
  if (/\b(report|progress|marks|grades|results|assessment|performance)\b/i.test(lower)) {
    return ['Thank you for the update', 'Can we discuss this further?', 'Great to hear!'];
  }

  // Apology
  if (/\b(sorry|apologize|apologies|my bad)\b/i.test(lower)) {
    return ['No worries!', "It's okay", 'Thank you for letting me know'];
  }

  // Heuristic fallback: question → answer starters, statement → acknowledgment
  if (lower.includes('?')) {
    return ['Yes, I can do that', "I'll get back to you", "I'm not sure, let me check"];
  }

  return ['Got it, thank you!', 'Noted 👍', 'Thanks for sharing'];
}
