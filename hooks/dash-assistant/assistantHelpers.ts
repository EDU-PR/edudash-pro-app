import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

import type { DashAttachment, DashMessage } from '@/services/dash-ai/types';
import type { LearnerContext } from '@/lib/dash-ai/learnerContext';
import { formatFileSize } from '@/services/AttachmentService';
import { normalizeLanguageCode } from '@/lib/ai/dashSettings';
import { getCurrentLanguage } from '@/lib/i18n';
import {
  resolveAgeBand,
  formatGradeLabel,
  isPreschoolContext,
} from '@/lib/dash-ai/learnerContext';
import { buildIntelligentSystemPrompt, buildAttachmentContext } from '@/lib/dash-ai/promptBuilder';
import {
  MAX_IMAGE_BASE64_LEN,
  IMAGE_COMPRESS_STEPS,
} from '@/lib/dash-ai/imageCompression';

export const wantsLessonGenerator = (text: string, assistantText?: string): boolean => {
  const rx = /(create|plan|generate)\s+(a\s+)?lesson(\s+plan)?|lesson\s+plan|teach\s+.*(about|on)/i;
  if (rx.test(text)) return true;
  if (assistantText && rx.test(assistantText)) return true;
  return false;
};

export const extractFollowUps = (text: string): string[] => {
  try {
    const lines = (text || '').split(/\n+/);
    const results: string[] = [];
    for (const line of lines) {
      const m = line.match(/^\s*User:\s*(.+)$/i);
      if (m && m[1]) {
        const q = m[1].trim();
        if (q.length > 0) results.push(q);
      }
    }
    return results;
  } catch {
    return [];
  }
};

export const buildDashContextOverride = (params: {
  learner?: LearnerContext | null;
  messages: DashMessage[];
}): string => {
  const learner = params.learner || null;
  const gradeLabel = formatGradeLabel(learner?.grade);
  const ageYears = learner?.ageYears ?? null;
  const ageBand = learner?.ageBand || resolveAgeBand(ageYears, gradeLabel);
  const schoolType = learner?.schoolType || null;
  const preschoolMode = isPreschoolContext({
    ...learner,
    ageBand,
  });

  const preschoolRules = preschoolMode
    ? [
        'PRESCHOOL TEACHING RULES (always on for preschool):',
        '- Always use play-based, game-like activities.',
        '- Focus on letter recognition, phonics, number recognition, counting, shapes, colors, and fine-motor skills.',
        '- Keep instructions short (3-6 steps) and hands-on.',
        '- Include a quick interactive check (e.g., "Point to the letter A" or "Count to 5 with me").',
        '- Avoid formal tests or exam language unless a teacher explicitly asks.',
      ].join('\n')
    : null;

  const generalRules = [
    'DASH CONVERSATION STYLE:',
    '- Be warm, friendly, and conversational - like a helpful learning companion',
    '- Celebrate progress: "Great job!", "You\'re getting it!", "That\'s a smart connection!"',
    '- Be proactive: Suggest next steps, offer insights, make connections',
    '- Balance teaching with conversation - not every interaction needs to be a lesson',
    '',
    'RESPONSE STRUCTURE (for homework/learning questions):',
    '1. When user shares an image/document: ANALYZE THE ACTUAL CONTENT',
    '   - Describe what you see: "This is [textbook/worksheet/diagram]..."',
    '   - Read visible text word-for-word',
    '   - Be SPECIFIC to content shown, not generic advice',
    '   - NEVER say "I cannot see it" - the attachment is visible',
    '',
    '2. FORBIDDEN generic responses:',
    '   ❌ "Identify the problem, break it down, check your work"',
    '   ❌ "Organize approach, apply concept, reflect"',
    '   ✅ CORRECT: "This is Activity 7.1 about Multiple Intelligences..."',
    '',
    '3. Structure learning responses as:',
    '   **1. What this is about** (brief overview)',
    '   **2. Key concepts** (with examples)',
    '   **3. Step-by-step solution/explanation**',
    '   **4. Check understanding** (ONE diagnostic question)',
    '',
    '3. Formatting rules:',
    '- Use **bold** for headings',
    '- Use bullet points (•) for lists',
    '- Use numbered steps (1., 2., 3.) for sequences',
    '- Keep paragraphs short (2-3 sentences max)',
    '- Use line breaks between sections',
    '',
    '4. NEVER say: "I need more context", "I cannot see", "Please describe"',
    '   - If image attached: analyze it directly',
    '   - If unclear: make reasonable inference and explain',
  ].join('\n');

  const lines = [
    'DASH CONTEXT PACK (do not repeat verbatim):',
    learner?.learnerName ? `Learner: ${learner.learnerName}.` : null,
    gradeLabel ? `Grade: ${gradeLabel}.` : null,
    typeof ageYears === 'number' ? `Age: ${ageYears}.` : null,
    ageBand ? `Age band: ${ageBand}.` : null,
    schoolType ? `School type: ${schoolType}.` : null,
    learner?.role ? `User role: ${learner.role}.` : null,
    generalRules,
    preschoolRules,
  ].filter(Boolean);

  const messageHistory = params.messages.map(msg => ({
    role: msg.type === 'task_result' ? 'assistant' : msg.type,
    content: msg.content || '',
  }));
  const hour = new Date().getHours();
  const timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' =
    hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';

  const enrichedLearner: LearnerContext = {
    ...learner,
    ageBand: ageBand || undefined,
    ageYears: ageYears || undefined,
    grade: gradeLabel || undefined,
    schoolType: schoolType || undefined,
  };

  const intelligentPrompt = buildIntelligentSystemPrompt({
    learner: enrichedLearner,
    messageHistory,
    tutorMode: true,
    sessionStart: params.messages.length === 0,
    timeOfDay,
  });

  return `${lines.join('\n')}\n\n${intelligentPrompt}`;
};

export const buildAttachmentContextInternal = (attachments: DashAttachment[]) => {
  if (!attachments || attachments.length === 0) return null;

  const hasImages = attachments.some(a => a.kind === 'image');
  const hasDocuments = attachments.some(a => a.kind === 'document' || a.kind === 'pdf');

  const baseContext = buildAttachmentContext(attachments.length, hasImages, hasDocuments);

  const lines = attachments.map((attachment) => {
    const label = attachment.name || 'Attachment';
    const kind = attachment.kind || 'file';
    const size = typeof attachment.size === 'number' ? formatFileSize(attachment.size) : null;
    return `- ${label} (${kind}${size ? `, ${size}` : ''})`;
  });

  return `${baseContext}\n\nATTACHMENT LIST:\n${lines.join('\n')}`;
};

export const prepareAttachmentsForAI = async (attachments: DashAttachment[]) => {
  if (Platform.OS === 'web') return attachments;
  if (!attachments || attachments.length === 0) return attachments;

  const prepared: DashAttachment[] = [];

  for (const attachment of attachments) {
    if (attachment.kind !== 'image' || !attachment.previewUri) {
      prepared.push(attachment);
      continue;
    }

    const uri = attachment.previewUri || '';
    if (!uri) {
      prepared.push(attachment);
      continue;
    }

    let base64: string | null = null;
    let mediaType = 'image/jpeg';

    for (const step of IMAGE_COMPRESS_STEPS) {
      try {
        const result = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: step.width } }],
          {
            compress: step.compress,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          }
        );
        if (result.base64 && result.base64.length <= MAX_IMAGE_BASE64_LEN) {
          base64 = result.base64;
          mediaType = 'image/jpeg';
          break;
        }
      } catch {
        // Try next compression step
      }
    }

    if (!base64) {
      try {
        const fallback = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        if (fallback && fallback.length <= MAX_IMAGE_BASE64_LEN) {
          base64 = fallback;
          mediaType = attachment.mimeType || 'image/jpeg';
        }
      } catch {
        base64 = null;
      }
    }

    if (base64) {
      prepared.push({
        ...attachment,
        meta: {
          ...(attachment.meta || {}),
          image_base64: base64,
          image_media_type: mediaType,
        },
      });
    } else {
      prepared.push(attachment);
    }
  }

  return prepared;
};

export const resolveVoiceLocale = (lang?: string | null): 'en-ZA' | 'af-ZA' | 'zu-ZA' => {
  const base = normalizeLanguageCode(lang || getCurrentLanguage?.());
  if (base === 'af') return 'af-ZA';
  if (base === 'zu') return 'zu-ZA';
  return 'en-ZA';
};

export const sanitizeTutorUserContent = (content?: string | null) => {
  if (!content) return { content: '', sanitized: false };
  const lower = content.toLowerCase();
  const isTutorPrompt = /you are dash, an interactive tutor|tutor_payload|return only json|tutor mode override/i.test(lower);
  if (!isTutorPrompt) return { content, sanitized: false };

  const requestMatch = content.match(/Learner request:\s*([^\n]+)/i);
  if (requestMatch?.[1]) {
    return { content: requestMatch[1].trim(), sanitized: true };
  }
  const answerMatch = content.match(/Learner answer:\s*([^\n]+)/i);
  if (answerMatch?.[1]) {
    return { content: answerMatch[1].trim(), sanitized: true };
  }
  const questionMatch = content.match(/Question:\s*([^\n]+)/i);
  if (questionMatch?.[1]) {
    return { content: questionMatch[1].trim(), sanitized: true };
  }
  return { content: 'Tutor request', sanitized: true };
};
