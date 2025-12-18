/**
 * Process CV Upload Edge Function
 * 
 * Processes uploaded CVs (PDF, DOCX, images) and extracts structured data
 * Uses OpenAI Vision API for images, PDF parsing for PDFs, and text extraction for DOCX
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import Anthropic from "npm:@anthropic-ai/sdk@^0.71.0";
import OpenAI from "npm:openai@4.20.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CVProcessRequest {
  file_url: string; // Supabase Storage path
  organization_id: string;
  file_type: string; // pdf, docx, jpg, png, etc.
  storage_bucket?: string; // Default: 'cv-uploads'
}

interface ExtractedCVData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  education?: Array<{
    institution: string;
    degree?: string;
    year?: string;
  }>;
  experience?: Array<{
    company: string;
    position: string;
    duration?: string;
  }>;
  skills?: string[];
  summary?: string;
  raw_text: string;
  extraction_method: 'openai_vision' | 'pdf_text' | 'docx_text' | 'ocr';
}

/**
 * Fetch file from Supabase Storage
 */
async function fetchFileArrayBuffer(
  bucket: string,
  path: string
): Promise<ArrayBuffer> {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .download(path);

  if (error) {
    throw new Error(`Failed to download file: ${error.message}`);
  }

  if (!data) {
    throw new Error("File not found in storage");
  }

  return await data.arrayBuffer();
}

/**
 * Extract text from image using Anthropic Claude Vision (primary) or OpenAI Vision (fallback)
 */
async function extractTextFromImage(
  mimeType: string,
  buf: ArrayBuffer
): Promise<string> {
  const bytes = new Uint8Array(buf);
  const base64 = btoa(String.fromCharCode(...bytes));
  
  // Try Anthropic Claude Vision first (primary)
  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022", // Best vision model
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType,
                  data: base64,
                },
              },
              {
                type: "text",
                text: "Extract all text from this CV image verbatim, preserving structure where possible. Include all details: name, contact info, education, work experience, skills, etc.",
              },
            ],
          },
        ],
      });

      const content = response.content[0];
      if (content.type === "text") {
        console.log("✅ Text extracted using Anthropic Claude Vision");
        return content.text;
      }
    } catch (error: any) {
      console.error("Anthropic Vision API error:", error);
      // Fall through to OpenAI
    }
  }

  // Fallback to OpenAI Vision
  if (openai) {
    try {
      const dataUrl = `data:${mimeType};base64,${base64}`;
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert at extracting text from images. Extract all text verbatim, preserving structure where possible.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract all text from this CV image." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 4000,
      });

      console.log("✅ Text extracted using OpenAI Vision (fallback)");
      return response.choices[0]?.message?.content ?? "";
    } catch (error: any) {
      console.error("OpenAI Vision API error:", error);
      throw new Error(`OCR failed: ${error.message}`);
    }
  }

  throw new Error("No AI provider configured (ANTHROPIC_API_KEY or OPENAI_API_KEY required)");
}

/**
 * Extract structured CV data using Anthropic Claude (primary) or OpenAI (fallback)
 */
async function extractStructuredCVData(
  rawText: string
): Promise<ExtractedCVData> {
  const systemPrompt = `You are an expert at parsing CVs and extracting structured information. 
Extract the following information from the CV text:
- name: Full name
- email: Email address
- phone: Phone number
- address: Physical address
- education: Array of education entries with institution, degree, year
- experience: Array of work experience with company, position, duration
- skills: Array of skills
- summary: Professional summary or objective

Return a JSON object with these fields. If a field is not found, omit it.`;

  const userPrompt = `Extract structured information from this CV:\n\n${rawText.substring(0, 8000)}`;

  // Try Anthropic Claude first (primary)
  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type === "text") {
        const structured = JSON.parse(content.text) as Partial<ExtractedCVData>;
        console.log("✅ Structured data extracted using Anthropic Claude");
        return {
          ...structured,
          raw_text: rawText,
          extraction_method: 'openai_vision', // Keep for compatibility
        } as ExtractedCVData;
      }
    } catch (error: any) {
      console.error("Anthropic structured extraction error:", error);
      // Fall through to OpenAI
    }
  }

  // Fallback to OpenAI
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content ?? "{}";
      const structured = JSON.parse(content) as Partial<ExtractedCVData>;
      console.log("✅ Structured data extracted using OpenAI (fallback)");
      
      return {
        ...structured,
        raw_text: rawText,
        extraction_method: 'openai_vision',
      } as ExtractedCVData;
    } catch (error: any) {
      console.error("OpenAI structured extraction error:", error);
    }
  }

  // Fallback to raw text only
  console.warn("⚠️ No AI provider available, returning raw text only");
  return {
    raw_text: rawText,
    extraction_method: 'ocr',
  };
}

/**
 * Extract text from PDF using unpdf (Deno-compatible PDF.js)
 */
async function extractTextFromPDF(buf: ArrayBuffer): Promise<string> {
  try {
    // Use unpdf library for Deno
    // @deno-types="https://esm.sh/@types/node"
    const { extractText, getDocumentProxy } = await import("npm:unpdf@^0.4.0");
    
    const uint8Array = new Uint8Array(buf);
    const pdf = await getDocumentProxy(uint8Array);
    
    // Extract text from all pages
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    
    console.log(`Extracted text from PDF: ${totalPages} pages, ${text.length} characters`);
    
    if (!text || text.trim().length === 0) {
      throw new Error("No text content found in PDF");
    }
    
    return text;
  } catch (error: any) {
    console.error("PDF extraction with unpdf failed:", error);
    // Fallback to OpenAI Vision OCR
    console.log("Falling back to OpenAI Vision OCR for PDF");
    throw error; // Let caller handle fallback
  }
}

/**
 * Extract text from DOCX using jszip and DOMParser
 */
async function extractTextFromDOCX(buf: ArrayBuffer): Promise<string> {
  try {
    // DOCX is a ZIP archive containing XML files
    // Use jszip to extract and DOMParser to parse XML
    const JSZip = (await import("npm:jszip@^3.10.1")).default;
    
    const zip = await JSZip.loadAsync(buf);
    
    // DOCX main content is in word/document.xml
    const documentXml = await zip.file("word/document.xml")?.async("string");
    
    if (!documentXml) {
      throw new Error("Could not find word/document.xml in DOCX file");
    }
    
    // Parse XML using Deno's built-in DOMParser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(documentXml, "application/xml");
    
    // Check for parsing errors
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      throw new Error(`XML parsing error: ${parserError.textContent}`);
    }
    
    // Extract text from <w:t> elements (text nodes in DOCX)
    const textNodes = xmlDoc.getElementsByTagName("w:t");
    const textParts: string[] = [];
    
    for (let i = 0; i < textNodes.length; i++) {
      const textNode = textNodes[i];
      const text = textNode.textContent?.trim();
      if (text) {
        textParts.push(text);
      }
    }
    
    const extractedText = textParts.join(" ");
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error("No text content found in DOCX");
    }
    
    console.log(`Extracted text from DOCX: ${extractedText.length} characters`);
    
    return extractedText;
  } catch (error: any) {
    console.error("DOCX extraction failed:", error);
    throw new Error(`DOCX extraction failed: ${error.message}`);
  }
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
    const payload: CVProcessRequest = await req.json();
    const { file_url, organization_id, file_type, storage_bucket = "cv-uploads" } = payload;

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

    console.log(`Processing CV: ${file_url} (${file_type})`);

    // Download file from storage
    const fileBuffer = await fetchFileArrayBuffer(storage_bucket, file_url);

    // Extract text based on file type
    let rawText = "";
    let extractionMethod: ExtractedCVData['extraction_method'] = 'ocr';

    if (file_type === "pdf") {
      // Try PDF extraction, fallback to OCR if needed
      try {
        rawText = await extractTextFromPDF(fileBuffer);
        extractionMethod = 'pdf_text';
      } catch (pdfError) {
        console.warn("PDF text extraction failed, falling back to OCR:", pdfError);
        // Fallback to Vision OCR (Anthropic or OpenAI)
        rawText = await extractTextFromImage("application/pdf", fileBuffer);
        extractionMethod = 'openai_vision'; // Keep for compatibility
      }
    } else if (file_type === "docx") {
      rawText = await extractTextFromDOCX(fileBuffer);
      extractionMethod = 'docx_text';
    } else if (["jpg", "jpeg", "png", "webp"].includes(file_type.toLowerCase())) {
      const mimeType = `image/${file_type === "jpg" ? "jpeg" : file_type}`;
      rawText = await extractTextFromImage(mimeType, fileBuffer);
      extractionMethod = 'openai_vision';
    } else {
      return new Response(
        JSON.stringify({ error: `Unsupported file type: ${file_type}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!rawText || rawText.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "No text could be extracted from the CV" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract structured data using OpenAI
    const structuredData = await extractStructuredCVData(rawText);
    structuredData.extraction_method = extractionMethod;

    // Store processed CV in database (org-admin uploads table)
    const { data: cvRecord, error: insertError } = await supabase
      .from("cv_uploads")
      .insert({
        organization_id,
        uploaded_by: user.id,
        file_url,
        file_type,
        extracted_data: structuredData,
        status: "processed",
        processed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to store CV:", insertError);
      // Return extracted data even if storage fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: structuredData,
        cv_id: cvRecord?.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("CV processing error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process CV",
        message: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

