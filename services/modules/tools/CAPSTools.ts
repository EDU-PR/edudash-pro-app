/**
 * CAPS Curriculum Tools for Dash AI
 * 
 * Tools for searching and retrieving CAPS curriculum content
 */

import { logger } from '@/lib/logger';
import type { AgentTool } from '../DashToolRegistry';

export function registerCAPSTools(register: (tool: AgentTool) => void): void {
  
  // Search CAPS curriculum
  register({
    name: 'search_caps_curriculum',
    description: 'Search the CAPS curriculum database for topics, learning outcomes, or content standards. Returns matched curriculum content with grade levels and subjects.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (topic, concept, or keyword)'
        },
        grade: {
          type: 'string',
          description: 'Optional: Specific grade level (e.g., "Grade R", "Grade 1")'
        },
        subject: {
          type: 'string',
          description: 'Optional: Subject area (e.g., "Mathematics", "Life Skills", "English Home Language")'
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10)'
        }
      },
      required: ['query']
    },
    risk: 'low',
    execute: async (args) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        
        // Build search query
        let query = supabase
          .from('caps_curriculum')
          .select('*')
          .textSearch('content', args.query, { type: 'websearch' });
        
        if (args.grade) {
          query = query.ilike('grade', `%${args.grade}%`);
        }
        
        if (args.subject) {
          query = query.ilike('subject', `%${args.subject}%`);
        }
        
        const limit = Math.min(args.limit || 10, 50);
        query = query.limit(limit);
        
        const { data, error } = await query;
        
        if (error) {
          // If table doesn't exist or search fails, try alternative approach
          logger.warn('[search_caps_curriculum] Primary search failed:', error);
          
          // Try searching caps_documents table instead
          const { data: docData, error: docError } = await supabase
            .from('caps_documents')
            .select('*')
            .textSearch('content', args.query, { type: 'websearch' })
            .limit(limit);
          
          if (docError) {
            return {
              success: false,
              error: 'CAPS curriculum search failed',
              details: error.message
            };
          }
          
          return {
            success: true,
            results: docData || [],
            count: docData?.length || 0,
            source: 'caps_documents'
          };
        }
        
        return {
          success: true,
          results: data || [],
          count: data?.length || 0,
          query: args.query,
          filters: {
            grade: args.grade,
            subject: args.subject
          }
        };
      } catch (error) {
        logger.error('[search_caps_curriculum] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Search failed'
        };
      }
    }
  });

  // Get CAPS documents
  register({
    name: 'get_caps_documents',
    description: 'Retrieve CAPS curriculum documents for a specific grade and subject. Returns official curriculum guidelines and content.',
    parameters: {
      type: 'object',
      properties: {
        grade: {
          type: 'string',
          description: 'Grade level (e.g., "Grade R", "Grade 1", "Grade 2")'
        },
        subject: {
          type: 'string',
          description: 'Subject name (e.g., "Mathematics", "English Home Language", "Life Skills")'
        },
        term: {
          type: 'number',
          description: 'Optional: School term (1-4)'
        }
      },
      required: ['grade', 'subject']
    },
    risk: 'low',
    execute: async (args) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        
        let query = supabase
          .from('caps_documents')
          .select('*')
          .ilike('grade', `%${args.grade}%`)
          .ilike('subject', `%${args.subject}%`);
        
        if (args.term) {
          query = query.eq('term', args.term);
        }
        
        const { data, error } = await query;
        
        if (error) {
          logger.error('[get_caps_documents] Error:', error);
          return {
            success: false,
            error: 'Failed to retrieve CAPS documents',
            details: error.message
          };
        }
        
        return {
          success: true,
          documents: data || [],
          count: data?.length || 0,
          grade: args.grade,
          subject: args.subject,
          term: args.term
        };
      } catch (error) {
        logger.error('[get_caps_documents] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get documents'
        };
      }
    }
  });

  // Get CAPS subjects
  register({
    name: 'get_caps_subjects',
    description: 'Get list of CAPS subjects available for a specific grade level.',
    parameters: {
      type: 'object',
      properties: {
        grade: {
          type: 'string',
          description: 'Grade level (e.g., "Grade R", "Grade 1")'
        }
      },
      required: ['grade']
    },
    risk: 'low',
    execute: async (args) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        
        const { data, error } = await supabase
          .from('caps_documents')
          .select('subject')
          .ilike('grade', `%${args.grade}%`);
        
        if (error) {
          logger.error('[get_caps_subjects] Error:', error);
          
          // Return default subjects for early grades
          const gradeLevel = args.grade?.toLowerCase() || '';
          if (gradeLevel.includes('r') || gradeLevel.includes('1') || gradeLevel.includes('2') || gradeLevel.includes('3')) {
            return {
              success: true,
              subjects: [
                'Home Language',
                'First Additional Language', 
                'Mathematics',
                'Life Skills'
              ],
              grade: args.grade,
              source: 'default'
            };
          }
          
          return {
            success: false,
            error: 'Failed to retrieve subjects',
            details: error.message
          };
        }
        
        // Extract unique subjects
        const subjects = [...new Set(data?.map(d => d.subject).filter(Boolean))] as string[];
        
        return {
          success: true,
          subjects,
          grade: args.grade,
          count: subjects.length
        };
      } catch (error) {
        logger.error('[get_caps_subjects] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get subjects'
        };
      }
    }
  });
}
