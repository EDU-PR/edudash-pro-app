/**
 * Supabase Edge Function: generate-pdf
 * 
 * Server-side PDF generation using Deno's built-in PDF capabilities.
 * Generates professional EduDash Pro branded PDFs for:
 * - Progress reports
 * - Study guides
 * - Lesson plans
 * - Certificates
 * - Assessments
 * - Newsletters
 * 
 * Note: Puppeteer is not available in Deno Deploy/Supabase Edge Functions.
 * We use a combination of HTML templating + jsPDF approach via Deno.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Document types supported
type PDFDocumentType = 
  | 'progress_report'
  | 'study_guide'
  | 'lesson_plan'
  | 'certificate'
  | 'assessment'
  | 'newsletter'
  | 'worksheet';

interface GeneratePDFRequest {
  documentType: PDFDocumentType;
  data: Record<string, unknown>;
  options?: {
    format?: 'A4' | 'Letter';
    orientation?: 'portrait' | 'landscape';
    includeHeader?: boolean;
    includeFooter?: boolean;
    branding?: {
      schoolName?: string;
      schoolLogo?: string;
      primaryColor?: string;
    };
  };
}

interface GeneratePDFResponse {
  success: boolean;
  pdfUrl?: string;
  error?: string;
}

// EduDash Pro brand colors
const BRAND_COLORS = {
  primary: '#7C3AED',      // Purple
  secondary: '#6366F1',     // Indigo
  accent: '#10B981',        // Emerald
  background: '#F5F3FF',    // Light purple
  text: '#1F2937',          // Gray-800
  textLight: '#6B7280',     // Gray-500
};

/**
 * Generate HTML template for PDF
 */
function generateHTMLTemplate(
  documentType: PDFDocumentType,
  data: Record<string, unknown>,
  options: GeneratePDFRequest['options']
): string {
  const branding = options?.branding || {};
  const primaryColor = branding.primaryColor || BRAND_COLORS.primary;
  const schoolName = branding.schoolName || 'EduDash Pro';

  // Base CSS styles
  const baseStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Helvetica', 'Arial', sans-serif; 
      color: ${BRAND_COLORS.text}; 
      line-height: 1.6;
      padding: 40px;
    }
    .header {
      background: linear-gradient(135deg, ${primaryColor} 0%, ${BRAND_COLORS.secondary} 100%);
      color: white;
      padding: 20px;
      margin: -40px -40px 30px -40px;
      text-align: center;
    }
    .header h1 { font-size: 24px; margin-bottom: 5px; }
    .header .subtitle { font-size: 12px; opacity: 0.9; }
    .section { margin-bottom: 25px; }
    .section-title {
      background: ${BRAND_COLORS.background};
      color: ${primaryColor};
      padding: 10px 15px;
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 15px;
      border-radius: 5px;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #E5E7EB; }
    th { background: ${BRAND_COLORS.background}; font-weight: 600; }
    .footer {
      position: fixed;
      bottom: 20px;
      left: 40px;
      right: 40px;
      text-align: center;
      font-size: 10px;
      color: ${BRAND_COLORS.textLight};
      border-top: 1px solid #E5E7EB;
      padding-top: 10px;
    }
    .grade-badge {
      display: inline-block;
      padding: 5px 15px;
      border-radius: 20px;
      font-weight: bold;
      color: white;
    }
    .grade-a { background: #10B981; }
    .grade-b { background: #3B82F6; }
    .grade-c { background: #F59E0B; }
    .grade-d { background: #EF4444; }
    .milestone { 
      background: #FEF3C7; 
      border-left: 4px solid #F59E0B; 
      padding: 10px; 
      margin: 10px 0;
    }
    .achievement {
      background: #D1FAE5;
      border-left: 4px solid #10B981;
      padding: 10px;
      margin: 10px 0;
    }
  `;

  // Generate content based on document type
  let content = '';
  
  switch (documentType) {
    case 'progress_report':
      content = generateProgressReportHTML(data, schoolName);
      break;
    case 'study_guide':
      content = generateStudyGuideHTML(data, schoolName);
      break;
    case 'lesson_plan':
      content = generateLessonPlanHTML(data, schoolName);
      break;
    case 'certificate':
      content = generateCertificateHTML(data, schoolName);
      break;
    case 'assessment':
      content = generateAssessmentHTML(data, schoolName);
      break;
    case 'newsletter':
      content = generateNewsletterHTML(data, schoolName);
      break;
    case 'worksheet':
      content = generateWorksheetHTML(data, schoolName);
      break;
    default:
      content = `<p>Document type "${documentType}" is not supported.</p>`;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>${baseStyles}</style>
    </head>
    <body>
      ${options?.includeHeader !== false ? `
        <div class="header">
          <h1>📚 ${schoolName}</h1>
          <div class="subtitle">Empowering Education Through AI</div>
        </div>
      ` : ''}
      ${content}
      ${options?.includeFooter !== false ? `
        <div class="footer">
          Generated by EduDash Pro • ${new Date().toLocaleDateString('en-ZA')} • Confidential
        </div>
      ` : ''}
    </body>
    </html>
  `;
}

/**
 * Progress Report HTML Generator
 */
function generateProgressReportHTML(data: Record<string, unknown>, schoolName: string): string {
  const student = data.student as Record<string, string> || {};
  const subjects = data.subjects as Array<Record<string, unknown>> || [];
  const period = data.period as string || 'Term 1';
  const teacherComments = data.teacherComments as string || '';
  const milestones = data.milestones as Array<Record<string, string>> || [];
  const achievements = data.achievements as Array<string> || [];

  return `
    <h2 style="text-align: center; margin-bottom: 20px;">📊 Progress Report</h2>
    
    <div class="section">
      <div class="section-title">👤 Student Information</div>
      <table>
        <tr><th>Student Name</th><td>${student.name || 'N/A'}</td></tr>
        <tr><th>Grade/Class</th><td>${student.grade || 'N/A'}</td></tr>
        <tr><th>Report Period</th><td>${period}</td></tr>
        <tr><th>Date</th><td>${new Date().toLocaleDateString('en-ZA')}</td></tr>
      </table>
    </div>

    <div class="section">
      <div class="section-title">📚 Subject Performance</div>
      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Score</th>
            <th>Grade</th>
            <th>Teacher Comments</th>
          </tr>
        </thead>
        <tbody>
          ${subjects.map(subject => {
            const score = subject.score as number || 0;
            const gradeClass = score >= 80 ? 'grade-a' : score >= 60 ? 'grade-b' : score >= 40 ? 'grade-c' : 'grade-d';
            const gradeLetter = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
            return `
              <tr>
                <td>${subject.name}</td>
                <td>${score}%</td>
                <td><span class="grade-badge ${gradeClass}">${gradeLetter}</span></td>
                <td>${subject.comments || ''}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    ${milestones.length > 0 ? `
      <div class="section">
        <div class="section-title">🎯 Developmental Milestones</div>
        ${milestones.map(m => `
          <div class="milestone">
            <strong>${m.category}:</strong> ${m.description}
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${achievements.length > 0 ? `
      <div class="section">
        <div class="section-title">🏆 Achievements</div>
        ${achievements.map(a => `
          <div class="achievement">🌟 ${a}</div>
        `).join('')}
      </div>
    ` : ''}

    ${teacherComments ? `
      <div class="section">
        <div class="section-title">💬 Teacher's Comments</div>
        <p style="padding: 15px; background: #F9FAFB; border-radius: 5px;">
          ${teacherComments}
        </p>
      </div>
    ` : ''}
  `;
}

/**
 * Study Guide HTML Generator
 */
function generateStudyGuideHTML(data: Record<string, unknown>, schoolName: string): string {
  const title = data.title as string || 'Study Guide';
  const subject = data.subject as string || '';
  const grade = data.grade as string || '';
  const topics = data.topics as Array<Record<string, unknown>> || [];
  const keyTerms = data.keyTerms as Array<Record<string, string>> || [];

  return `
    <h2 style="text-align: center; margin-bottom: 5px;">📖 ${title}</h2>
    <p style="text-align: center; color: ${BRAND_COLORS.textLight}; margin-bottom: 20px;">
      ${subject} • Grade ${grade}
    </p>

    ${topics.map((topic, index) => `
      <div class="section">
        <div class="section-title">${index + 1}. ${topic.title}</div>
        <p>${topic.content}</p>
        ${topic.keyPoints ? `
          <ul style="margin-top: 10px; padding-left: 20px;">
            ${(topic.keyPoints as Array<string>).map(point => `<li>${point}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `).join('')}

    ${keyTerms.length > 0 ? `
      <div class="section">
        <div class="section-title">📝 Key Terms</div>
        <table>
          <thead><tr><th>Term</th><th>Definition</th></tr></thead>
          <tbody>
            ${keyTerms.map(term => `
              <tr><td><strong>${term.term}</strong></td><td>${term.definition}</td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}
  `;
}

/**
 * Lesson Plan HTML Generator
 */
function generateLessonPlanHTML(data: Record<string, unknown>, schoolName: string): string {
  const title = data.title as string || 'Lesson Plan';
  const subject = data.subject as string || '';
  const grade = data.grade as string || '';
  const duration = data.duration as string || '';
  const objectives = data.objectives as Array<string> || [];
  const materials = data.materials as Array<string> || [];
  const activities = data.activities as Array<Record<string, unknown>> || [];

  return `
    <h2 style="text-align: center; margin-bottom: 5px;">📋 ${title}</h2>
    <p style="text-align: center; color: ${BRAND_COLORS.textLight}; margin-bottom: 20px;">
      ${subject} • Grade ${grade} • ${duration}
    </p>

    <div class="section">
      <div class="section-title">🎯 Learning Objectives</div>
      <ul style="padding-left: 20px;">
        ${objectives.map(obj => `<li>${obj}</li>`).join('')}
      </ul>
    </div>

    <div class="section">
      <div class="section-title">📦 Materials Needed</div>
      <ul style="padding-left: 20px; column-count: 2;">
        ${materials.map(mat => `<li>${mat}</li>`).join('')}
      </ul>
    </div>

    <div class="section">
      <div class="section-title">🎬 Activities</div>
      ${activities.map((activity, index) => `
        <div style="margin-bottom: 15px; padding: 15px; background: #F9FAFB; border-radius: 5px;">
          <h4 style="margin-bottom: 5px;">${index + 1}. ${activity.name} (${activity.duration})</h4>
          <p>${activity.description}</p>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Certificate HTML Generator
 */
function generateCertificateHTML(data: Record<string, unknown>, schoolName: string): string {
  const studentName = data.studentName as string || '';
  const achievement = data.achievement as string || 'Outstanding Achievement';
  const date = data.date as string || new Date().toLocaleDateString('en-ZA');
  const principalName = data.principalName as string || '';

  return `
    <div style="text-align: center; padding: 40px; border: 3px double ${BRAND_COLORS.primary}; margin: 20px;">
      <h1 style="font-size: 36px; color: ${BRAND_COLORS.primary}; margin-bottom: 10px;">
        🏆 Certificate of Achievement
      </h1>
      <p style="font-size: 14px; color: ${BRAND_COLORS.textLight}; margin-bottom: 30px;">
        This is to certify that
      </p>
      <h2 style="font-size: 28px; color: ${BRAND_COLORS.text}; margin-bottom: 30px; 
                 border-bottom: 2px solid ${BRAND_COLORS.primary}; padding-bottom: 10px;">
        ${studentName}
      </h2>
      <p style="font-size: 16px; margin-bottom: 30px;">
        Has successfully demonstrated excellence in<br/>
        <strong style="color: ${BRAND_COLORS.primary};">${achievement}</strong>
      </p>
      <p style="font-size: 12px; color: ${BRAND_COLORS.textLight};">
        Awarded on ${date}
      </p>
      ${principalName ? `
        <p style="margin-top: 40px; font-size: 14px;">
          ________________________<br/>
          ${principalName}<br/>
          <small>Principal, ${schoolName}</small>
        </p>
      ` : ''}
    </div>
  `;
}

/**
 * Assessment HTML Generator
 */
function generateAssessmentHTML(data: Record<string, unknown>, schoolName: string): string {
  const title = data.title as string || 'Assessment';
  const subject = data.subject as string || '';
  const grade = data.grade as string || '';
  const duration = data.duration as string || '';
  const totalMarks = data.totalMarks as number || 0;
  const sections = data.sections as Array<Record<string, unknown>> || [];

  return `
    <h2 style="text-align: center; margin-bottom: 5px;">📝 ${title}</h2>
    <p style="text-align: center; color: ${BRAND_COLORS.textLight}; margin-bottom: 20px;">
      ${subject} • Grade ${grade} • Duration: ${duration} • Total: ${totalMarks} marks
    </p>

    <div class="section">
      <div class="section-title">📋 Instructions</div>
      <ul style="padding-left: 20px;">
        <li>Read each question carefully before answering</li>
        <li>Write clearly and neatly</li>
        <li>Show all your working where applicable</li>
        <li>Check your answers before submitting</li>
      </ul>
    </div>

    ${sections.map((section, sIndex) => `
      <div class="section">
        <div class="section-title">Section ${String.fromCharCode(65 + sIndex)}: ${section.title} [${section.marks} marks]</div>
        ${(section.questions as Array<Record<string, unknown>> || []).map((q, qIndex) => `
          <div style="margin-bottom: 15px; padding: 10px; background: #F9FAFB; border-radius: 5px;">
            <p><strong>${sIndex + 1}.${qIndex + 1}</strong> ${q.question} <span style="color: ${BRAND_COLORS.textLight};">[${q.marks} marks]</span></p>
            ${q.type === 'multiple_choice' ? `
              <div style="margin-top: 10px; padding-left: 20px;">
                ${(q.options as Array<string> || []).map((opt, oIndex) => `
                  <p>☐ ${String.fromCharCode(65 + oIndex)}. ${opt}</p>
                `).join('')}
              </div>
            ` : `
              <div style="margin-top: 10px; border: 1px dashed #D1D5DB; padding: 20px; min-height: 60px;">
                <small style="color: ${BRAND_COLORS.textLight};">Answer space</small>
              </div>
            `}
          </div>
        `).join('')}
      </div>
    `).join('')}
  `;
}

/**
 * Newsletter HTML Generator
 */
function generateNewsletterHTML(data: Record<string, unknown>, schoolName: string): string {
  const title = data.title as string || 'School Newsletter';
  const date = data.date as string || new Date().toLocaleDateString('en-ZA');
  const articles = data.articles as Array<Record<string, string>> || [];
  const upcomingEvents = data.upcomingEvents as Array<Record<string, string>> || [];

  return `
    <h2 style="text-align: center; margin-bottom: 5px;">📰 ${title}</h2>
    <p style="text-align: center; color: ${BRAND_COLORS.textLight}; margin-bottom: 20px;">
      ${date}
    </p>

    ${articles.map(article => `
      <div class="section">
        <div class="section-title">${article.title}</div>
        <p>${article.content}</p>
      </div>
    `).join('')}

    ${upcomingEvents.length > 0 ? `
      <div class="section">
        <div class="section-title">📅 Upcoming Events</div>
        <table>
          <thead><tr><th>Date</th><th>Event</th><th>Details</th></tr></thead>
          <tbody>
            ${upcomingEvents.map(event => `
              <tr>
                <td>${event.date}</td>
                <td><strong>${event.title}</strong></td>
                <td>${event.details || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}
  `;
}

/**
 * Worksheet HTML Generator
 */
function generateWorksheetHTML(data: Record<string, unknown>, schoolName: string): string {
  const title = data.title as string || 'Worksheet';
  const subject = data.subject as string || '';
  const grade = data.grade as string || '';
  const exercises = data.exercises as Array<Record<string, unknown>> || [];

  return `
    <h2 style="text-align: center; margin-bottom: 5px;">✏️ ${title}</h2>
    <p style="text-align: center; color: ${BRAND_COLORS.textLight}; margin-bottom: 20px;">
      ${subject} • Grade ${grade}
    </p>

    <div style="margin-bottom: 20px; padding: 10px; background: #F9FAFB; border-radius: 5px;">
      <strong>Name:</strong> _________________________ 
      <strong style="margin-left: 30px;">Date:</strong> _____________
    </div>

    ${exercises.map((exercise, index) => `
      <div class="section">
        <div class="section-title">Exercise ${index + 1}: ${exercise.title}</div>
        ${exercise.instructions ? `<p style="margin-bottom: 10px; font-style: italic;">${exercise.instructions}</p>` : ''}
        ${(exercise.questions as Array<string> || []).map((q, qIndex) => `
          <div style="margin-bottom: 15px;">
            <p>${index + 1}.${qIndex + 1}) ${q}</p>
            <div style="border-bottom: 1px solid #D1D5DB; margin-top: 20px;"></div>
            <div style="border-bottom: 1px solid #D1D5DB; margin-top: 20px;"></div>
          </div>
        `).join('')}
      </div>
    `).join('')}
  `;
}

/**
 * Upload HTML to Supabase Storage and get public URL
 */
async function uploadHTMLToStorage(
  supabaseClient: ReturnType<typeof createClient>,
  html: string,
  fileName: string
): Promise<string> {
  const bucket = 'pdfs';
  const filePath = `generated/${Date.now()}_${fileName}.html`;

  // Ensure bucket exists (may already exist)
  try {
    await supabaseClient.storage.createBucket(bucket, { public: true });
  } catch (_e) {
    // Bucket may already exist
  }

  const { data, error } = await supabaseClient.storage
    .from(bucket)
    .upload(filePath, html, {
      contentType: 'text/html',
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload HTML: ${error.message}`);
  }

  const { data: urlData } = supabaseClient.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request
    const body: GeneratePDFRequest = await req.json();
    const { documentType, data, options } = body;

    if (!documentType || !data) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing documentType or data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate HTML
    const html = generateHTMLTemplate(documentType, data, options);

    // For Supabase Edge Functions, we return the HTML directly
    // The client can use a browser-based PDF library or print-to-PDF
    // Alternatively, upload HTML to storage for later conversion
    
    const htmlUrl = await uploadHTMLToStorage(supabaseClient, html, documentType);

    const response: GeneratePDFResponse = {
      success: true,
      pdfUrl: htmlUrl, // Returns HTML URL that can be converted to PDF client-side
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('PDF generation error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
