/**
 * Generate Exam Edge Function
 * 
 * Uses AI to generate a structured exam for a given grade, subject, and exam type.
 * Called from web generate-exam page.
 * 
 * Expected body: { grade, subject, examType, customPrompt? }
 * Auth: Bearer token required
 * 
 * Returns: { success: true, exam: ExamData, examId: string }
 */

import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

const EXAM_SYSTEM_PROMPT = `You are an expert South African education exam generator aligned with the CAPS curriculum.
Generate a structured exam in valid JSON format. The exam must include:
- A title
- Multiple sections, each with a name and array of questions
- Each question must have: id (string), text, type (one of: multiple_choice, true_false, short_answer, fill_in_blank), points (number)
- For multiple_choice: include "options" array and "correctAnswer" (the correct option text)
- For true_false: include "correctAnswer" as "True" or "False"
- For short_answer/fill_in_blank: include "correctAnswer" string

Return ONLY valid JSON with this structure:
{
  "title": "...",
  "grade": "...",
  "subject": "...",
  "totalMarks": number,
  "duration": "... minutes",
  "sections": [
    {
      "name": "Section A: ...",
      "questions": [
        {
          "id": "q1",
          "text": "...",
          "type": "multiple_choice",
          "options": ["A", "B", "C", "D"],
          "correctAnswer": "B",
          "points": 2
        }
      ]
    }
  ]
}`;

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return handleCorsOptions(req);
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { grade, subject, examType, customPrompt } = body;

    if (!grade || !subject) {
      return new Response(JSON.stringify({ error: 'Missing required fields: grade, subject' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build the user prompt
    let userPrompt = `Generate a ${examType || 'practice'} exam for Grade ${grade}, Subject: ${subject}.`;
    if (customPrompt) {
      userPrompt += `\n\nAdditional instructions: ${customPrompt}`;
    }
    userPrompt += '\n\nInclude a mix of question types. Aim for 20-30 questions across 2-4 sections.';

    console.log('[generate-exam] Generating exam:', { grade, subject, examType, userId: user.id });

    // Call Anthropic API
    if (!ANTHROPIC_API_KEY) {
      throw new Error('AI service not configured');
    }

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 4096,
        system: EXAM_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[generate-exam] AI API error:', aiResponse.status, errText);
      if (aiResponse.status === 429) {
        throw new Error('AI service is busy. Please try again in a moment.');
      }
      throw new Error('Failed to generate exam content');
    }

    const aiData = await aiResponse.json();
    const content = aiData.content?.[0]?.text || '';

    // Parse the JSON from the AI response
    let exam;
    try {
      // Try to extract JSON from the response (may be wrapped in markdown code block)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      exam = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('[generate-exam] Failed to parse AI response:', parseErr);
      throw new Error('Failed to parse exam content. Please try again.');
    }

    // Validate exam structure
    if (!exam.sections || !Array.isArray(exam.sections) || exam.sections.length === 0) {
      throw new Error('Generated exam has invalid structure. Please try again.');
    }

    // Save to database
    const { data: savedExam, error: saveError } = await supabase
      .from('generated_exams')
      .insert({
        user_id: user.id,
        grade,
        subject,
        exam_type: examType || 'practice',
        generated_content: JSON.stringify(exam),
        status: 'generated',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (saveError) {
      // Non-critical — exam was generated, just couldn't be saved
      console.warn('[generate-exam] Could not save exam to DB:', saveError);
    }

    const examId = savedExam?.id || `temp-${Date.now()}`;

    console.log('[generate-exam] Exam generated successfully:', {
      examId,
      sections: exam.sections.length,
      totalQuestions: exam.sections.reduce(
        (acc: number, s: any) => acc + (s.questions?.length || 0),
        0
      ),
    });

    return new Response(
      JSON.stringify({ success: true, exam, examId }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('[generate-exam] Error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
