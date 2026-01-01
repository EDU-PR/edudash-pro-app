/**
 * Textbook Content Tool
 * 
 * Provides Dash AI access to approved South African textbooks.
 * Enables finding relevant content for learning support.
 * 
 * **Features:**
 * - Search textbooks by grade and subject
 * - Find chapters covering specific CAPS topics
 * - Get content recommendations for students
 * - Access textbook metadata and descriptions
 * 
 * **Security:**
 * - Read-only access to textbook metadata
 * - Available to all authenticated users
 * - Low risk - educational content references
 */

import { Tool, ToolCategory, RiskLevel, ToolParameter, ToolExecutionContext, ToolExecutionResult } from '../types';
import { assertSupabase } from '@/lib/supabase';

const TextbookContentTool: Tool = {
  id: 'textbook_content',
  name: 'Textbook Content Search',
  description: 'Search approved South African textbooks and find relevant chapters for learning. Helps students and parents find study materials for specific topics.',
  category: 'education' as ToolCategory,
  riskLevel: 'low' as RiskLevel,
  
  allowedRoles: ['superadmin', 'principal', 'teacher', 'parent', 'student'],
  requiredTier: undefined,
  
  parameters: [
    {
      name: 'grade',
      type: 'string',
      description: 'Grade level to search (R, 1-12)',
      required: false,
    },
    {
      name: 'subject',
      type: 'string',
      description: 'Subject area (Mathematics, English, Life Skills, etc.)',
      required: false,
    },
    {
      name: 'topic',
      type: 'string',
      description: 'Specific topic to find content for',
      required: false,
    },
    {
      name: 'language',
      type: 'string',
      description: 'Language of textbook (en, af, zu, xh)',
      required: false,
      enum: ['en', 'af', 'zu', 'xh'],
    },
    {
      name: 'caps_approved_only',
      type: 'boolean',
      description: 'Only return CAPS-approved textbooks',
      required: false,
    },
  ] as ToolParameter[],
  
  claudeToolDefinition: {
    name: 'textbook_content',
    description: 'Search approved South African textbooks by grade, subject, and topic. Find relevant study materials and chapters for students.',
    input_schema: {
      type: 'object' as const,
      properties: {
        grade: {
          type: 'string',
          description: 'Grade level (R, 1-12)',
        },
        subject: {
          type: 'string',
          description: 'Subject area',
        },
        topic: {
          type: 'string',
          description: 'Specific topic to search for',
        },
        language: {
          type: 'string',
          enum: ['en', 'af', 'zu', 'xh'],
          description: 'Textbook language',
        },
        caps_approved_only: {
          type: 'boolean',
          description: 'Only CAPS-approved textbooks',
        },
      },
      required: [],
    },
  },
  
  execute: async (
    params: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> => {
    try {
      const supabase = assertSupabase();
      
      // Query textbooks
      let textbookQuery = supabase
        .from('textbooks')
        .select('*')
        .eq('is_active', true);
      
      if (params.grade) {
        textbookQuery = textbookQuery.eq('grade', params.grade);
      }
      
      if (params.subject) {
        textbookQuery = textbookQuery.ilike('subject', `%${params.subject}%`);
      }
      
      if (params.language) {
        textbookQuery = textbookQuery.eq('language', params.language);
      }
      
      if (params.caps_approved_only) {
        textbookQuery = textbookQuery.eq('caps_approved', true);
      }
      
      if (params.topic) {
        // Search in CAPS topics array
        textbookQuery = textbookQuery.contains('caps_topics', [params.topic]);
      }
      
      textbookQuery = textbookQuery.order('grade').order('subject').limit(15);
      
      const { data: textbooks, error: textbookError } = await textbookQuery;
      
      if (textbookError) {
        return {
          success: false,
          error: `Failed to query textbooks: ${textbookError.message}`,
        };
      }
      
      if (!textbooks || textbooks.length === 0) {
        return {
          success: true,
          data: {
            textbooks: [],
            message: 'No textbooks found matching your criteria.',
            suggestions: [
              'Try a different grade level',
              'Search for a broader subject area',
              'Remove some filters to see more results',
            ],
          },
        };
      }
      
      // Format results
      const formattedTextbooks = textbooks.map((book: any) => ({
        id: book.id,
        title: book.title,
        publisher: book.publisher,
        grade: book.grade,
        subject: book.subject,
        language: book.language,
        description: book.description,
        capsApproved: book.caps_approved,
        totalPages: book.total_pages,
        capsTopics: book.caps_topics || [],
        pdfAvailable: !!book.pdf_url,
      }));
      
      // If a specific topic was searched, also query chapters
      let relevantChapters: any[] = [];
      if (params.topic && textbooks.length > 0) {
        const textbookIds = textbooks.map((b: any) => b.id);
        
        const { data: chapters } = await supabase
          .from('textbook_chapters')
          .select('*')
          .in('textbook_id', textbookIds)
          .or(`title.ilike.%${params.topic}%,summary.ilike.%${params.topic}%`)
          .limit(10);
        
        relevantChapters = (chapters || []).map((ch: any) => ({
          id: ch.id,
          textbookId: ch.textbook_id,
          chapterNumber: ch.chapter_number,
          title: ch.title,
          summary: ch.summary,
          startPage: ch.start_page,
          endPage: ch.end_page,
          capsTopics: ch.caps_topics || [],
        }));
      }
      
      return {
        success: true,
        data: {
          textbooks: formattedTextbooks,
          chapters: relevantChapters,
          count: formattedTextbooks.length,
          chaptersFound: relevantChapters.length,
          filters: {
            grade: params.grade || 'all',
            subject: params.subject || 'all',
            language: params.language || 'all',
            topic: params.topic || null,
          },
          message: `Found ${formattedTextbooks.length} textbook${formattedTextbooks.length !== 1 ? 's' : ''}${relevantChapters.length > 0 ? ` and ${relevantChapters.length} relevant chapter${relevantChapters.length !== 1 ? 's' : ''}` : ''}`,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Textbook search failed: ${error.message}`,
      };
    }
  },
};

export { TextbookContentTool };
