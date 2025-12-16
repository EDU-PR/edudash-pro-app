/**
 * Dash AI Automation Edge Function
 * 
 * Provides AI-powered automation tools for organizations:
 * - Generate Announcements
 * - Generate Reports
 * - Learner Insights
 * - Auto Responses
 * - Content Suggestions
 * - Learner Matching
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import OpenAI from "npm:openai@4.20.1";
import Anthropic from "npm:@anthropic-ai/sdk@^0.71.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY=REDACTED
const OPENAI_API_KEY=REDACTED
const ANTHROPIC_API_KEY=REDACTED

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AutomationTool = 
  | 'generate-announcements'
  | 'generate-reports'
  | 'learner-insights'
  | 'auto-responses'
  | 'content-suggestions'
  | 'learner-matching';

interface AutomationRequest {
  tool_id: AutomationTool;
  prompt: string;
  organization_id: string;
  action: 'generate';
  context?: Record<string, any>; // Additional context for the tool
}

interface ToolPrompt {
  system: string;
  user: string;
}

/**
 * Get organization context for prompts
 */
async function getOrganizationContext(organizationId: string): Promise<string> {
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("name, type, settings")
    .eq("id", organizationId)
    .single();

  if (!org) return "";

  return `Organization: ${org.name} (${org.type || 'training_center'})`;
}

/**
 * Build prompt for Generate Announcements tool
 */
function buildAnnouncementsPrompt(
  userPrompt: string,
  orgContext: string
): ToolPrompt {
  return {
    system: `You are an expert at creating engaging educational announcements for ${orgContext}.
Create announcements that are:
- Clear and concise
- Professional yet friendly
- Engaging and motivating
- Include relevant details
- Suitable for the organization's context`,
    user: `Create an announcement based on: ${userPrompt}`,
  };
}

/**
 * Build prompt for Generate Reports tool
 */
async function buildReportsPrompt(
  userPrompt: string,
  orgContext: string,
  organizationId: string
): Promise<ToolPrompt> {
  // Fetch relevant data for context
  const { data: programs } = await supabaseAdmin
    .from("courses")
    .select("id, title, description")
    .eq("organization_id", organizationId)
    .limit(10);

  const programsList = programs?.map(p => `- ${p.title}`).join("\n") || "No programs found";

  return {
    system: `You are an expert at creating comprehensive educational reports for ${orgContext}.
Create reports that are:
- Data-driven and analytical
- Well-structured with clear sections
- Actionable with recommendations
- Professional in tone
- Include relevant metrics and insights`,
    user: `Create a report based on: ${userPrompt}\n\nRelevant programs:\n${programsList}`,
  };
}

/**
 * Build prompt for Learner Insights tool
 */
async function buildLearnerInsightsPrompt(
  userPrompt: string,
  orgContext: string,
  organizationId: string
): Promise<ToolPrompt> {
  // Fetch learner data for context
  const { data: enrollments } = await supabaseAdmin
    .from("enrollments")
    .select("id, status, created_at")
    .eq("organization_id", organizationId)
    .limit(100);

  const totalLearners = enrollments?.length || 0;
  const activeLearners = enrollments?.filter(e => e.status === 'active').length || 0;

  return {
    system: `You are an expert educational analyst for ${orgContext}.
Provide insights that are:
- Data-driven and evidence-based
- Actionable and specific
- Focused on learner success
- Include recommendations for improvement`,
    user: `Analyze learner data and provide insights based on: ${userPrompt}\n\nContext: ${totalLearners} total learners, ${activeLearners} active learners.`,
  };
}

/**
 * Build prompt for Auto Responses tool
 */
function buildAutoResponsesPrompt(
  userPrompt: string,
  orgContext: string
): ToolPrompt {
  return {
    system: `You are a helpful administrative assistant for ${orgContext}.
Create responses that are:
- Professional and courteous
- Helpful and informative
- Appropriate for the context
- Clear and concise`,
    user: `Create an appropriate response to: ${userPrompt}`,
  };
}

/**
 * Build prompt for Content Suggestions tool
 */
async function buildContentSuggestionsPrompt(
  userPrompt: string,
  orgContext: string,
  organizationId: string
): Promise<ToolPrompt> {
  const { data: programs } = await supabaseAdmin
    .from("courses")
    .select("title, description, category")
    .eq("organization_id", organizationId)
    .limit(20);

  const existingContent = programs?.map(p => `- ${p.title} (${p.category || 'general'})`).join("\n") || "No existing content";

  return {
    system: `You are a content strategy expert for ${orgContext}.
Suggest content that:
- Aligns with organizational goals
- Fills gaps in existing content
- Is relevant to the target audience
- Is practical and actionable`,
    user: `Suggest content ideas based on: ${userPrompt}\n\nExisting content:\n${existingContent}`,
  };
}

/**
 * Build prompt for Learner Matching tool
 */
async function buildLearnerMatchingPrompt(
  userPrompt: string,
  orgContext: string,
  organizationId: string
): Promise<ToolPrompt> {
  const { data: programs } = await supabaseAdmin
    .from("courses")
    .select("id, title, description, requirements")
    .eq("organization_id", organizationId)
    .limit(20);

  const programsList = programs?.map(p => `- ${p.title}: ${p.description || ''} (Requirements: ${p.requirements || 'none'})`).join("\n") || "No programs available";

  return {
    system: `You are an expert at matching learners with appropriate programs for ${orgContext}.
Provide matches that:
- Consider learner skills and goals
- Match program requirements
- Explain why the match is suitable
- Include recommendations for next steps`,
    user: `Match learners to programs based on: ${userPrompt}\n\nAvailable programs:\n${programsList}`,
  };
}

/**
 * Generate content using AI - Anthropic Claude (primary), OpenAI (fallback)
 */
async function generateContent(prompt: ToolPrompt): Promise<string> {
  // Use Anthropic Claude as primary (better quality, longer context)
  // Fall back to OpenAI if Anthropic is not available
  
  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022", // Best quality model
        max_tokens: 4096,
        system: prompt.system,
        messages: [
          {
            role: "user",
            content: prompt.user,
          },
        ],
      });

      const content = response.content[0];
      if (content.type === "text") {
        console.log("✅ Content generated using Anthropic Claude");
        return content.text;
      }
    } catch (error: any) {
      console.error("Anthropic API error:", error);
      // Fall through to OpenAI
    }
  }

  // Fallback to OpenAI
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      console.log("✅ Content generated using OpenAI (fallback)");
      return response.choices[0]?.message?.content ?? "";
    } catch (error: any) {
      console.error("OpenAI API error:", error);
      throw new Error(`AI generation failed: ${error.message}`);
    }
  }

  throw new Error("No AI provider configured (ANTHROPIC_API_KEY or OPENAI_API_KEY required)");
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with user's auth
    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      }
    );

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const payload: AutomationRequest = await req.json();
    const { tool_id, prompt, organization_id, action, context } = payload;

    if (action !== "generate") {
      return new Response(
        JSON.stringify({ error: `Unsupported action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has access to organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.organization_id !== organization_id) {
      return new Response(
        JSON.stringify({ error: "Forbidden: You don't have access to this organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get organization context
    const orgContext = await getOrganizationContext(organization_id);

    // Build appropriate prompt based on tool
    let toolPrompt: ToolPrompt;

    switch (tool_id) {
      case "generate-announcements":
        toolPrompt = buildAnnouncementsPrompt(prompt, orgContext);
        break;
      case "generate-reports":
        toolPrompt = await buildReportsPrompt(prompt, orgContext, organization_id);
        break;
      case "learner-insights":
        toolPrompt = await buildLearnerInsightsPrompt(prompt, orgContext, organization_id);
        break;
      case "auto-responses":
        toolPrompt = buildAutoResponsesPrompt(prompt, orgContext);
        break;
      case "content-suggestions":
        toolPrompt = await buildContentSuggestionsPrompt(prompt, orgContext, organization_id);
        break;
      case "learner-matching":
        toolPrompt = await buildLearnerMatchingPrompt(prompt, orgContext, organization_id);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown tool: ${tool_id}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Generate content
    const content = await generateContent(toolPrompt);

    // Log usage (optional)
    try {
      await supabaseAdmin.from("ai_usage_logs").insert({
        user_id: user.id,
        organization_id,
        service_type: `automation_${tool_id}`,
        metadata: { tool_id, prompt_length: prompt.length },
      });
    } catch (logError) {
      console.warn("Failed to log usage:", logError);
      // Non-fatal, continue
    }

    return new Response(
      JSON.stringify({
        success: true,
        content,
        tool_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("AI automation error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate content",
        message: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

