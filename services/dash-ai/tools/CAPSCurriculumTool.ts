/**
 * CAPS Curriculum Tool
 * 
 * Provides Dash AI access to South African CAPS curriculum data.
 * Allows querying learning objectives, topics, and content standards.
 * 
 * **Features:**
 * - Query CAPS topics by grade and subject
 * - Get learning outcomes and assessment standards
 * - Find prerequisites and skill requirements
 * - Search curriculum content by keyword
 * 
 * **Security:**
 * - Read-only access to curriculum data
 * - Available to all authenticated users
 * - Low risk - public educational content
 */

import { Tool, ToolCategory, RiskLevel, ToolParameter, ToolExecutionContext, ToolExecutionResult } from '../types';
import { assertSupabase } from '@/lib/supabase';

const CAPSCurriculumTool: Tool = {
  id: 'caps_curriculum_query',
  name: 'CAPS Curriculum Query',
  description: 'Search and retrieve South African CAPS curriculum topics, learning objectives, and content standards. Use this to help students, teachers, or parents understand what should be taught and learned at each grade level.',
  category: 'education' as ToolCategory,
  riskLevel: 'low' as RiskLevel,
  
  allowedRoles: ['superadmin', 'principal', 'teacher', 'parent', 'student'],
  requiredTier: undefined, // Available to all tiers
  
  parameters: [
    {
      name: 'grade',
      type: 'string',
      description: 'Grade level to query (R, 1-12, or ranges like "4-6", "10-12")',
      required: false,
    },
    {
      name: 'subject',
      type: 'string',
      description: 'Subject area (e.g., "Mathematics", "English", "Life Skills", "Natural Sciences")',
      required: false,
    },
    {
      name: 'term',
      type: 'number',
      description: 'School term (1-4)',
      required: false,
      validation: { min: 1, max: 4 },
    },
    {
      name: 'search_query',
      type: 'string',
      description: 'Search text to find in topic titles and content',
      required: false,
    },
    {
      name: 'include_details',
      type: 'boolean',
      description: 'Include full learning outcomes and assessment standards',
      required: false,
    },
  ] as ToolParameter[],
  
  claudeToolDefinition: {
    name: 'caps_curriculum_query',
    description: 'Search and retrieve South African CAPS curriculum topics, learning objectives, and content standards for any grade and subject. Helps understand what students should learn and how they should be assessed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        grade: {
          type: 'string',
          description: 'Grade level (R, 1-12)',
        },
        subject: {
          type: 'string',
          description: 'Subject area (Mathematics, English, Life Skills, etc.)',
        },
        term: {
          type: 'number',
          description: 'School term (1-4)',
        },
        search_query: {
          type: 'string',
          description: 'Search text for topics and content',
        },
        include_details: {
          type: 'boolean',
          description: 'Include learning outcomes and assessment standards',
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
      
      let query = supabase
        .from('caps_topics')
        .select('*');
      
      // Apply filters
      if (params.grade) {
        query = query.eq('grade', params.grade);
      }
      
      if (params.subject) {
        query = query.ilike('subject', `%${params.subject}%`);
      }
      
      if (params.term) {
        query = query.eq('term', params.term);
      }
      
      if (params.search_query) {
        // Use text search
        query = query.or(
          `topic_title.ilike.%${params.search_query}%,content_outline.ilike.%${params.search_query}%`
        );
      }
      
      // Order by grade and topic
      query = query.order('grade').order('topic_code');
      
      // Limit results
      query = query.limit(20);
      
      const { data, error } = await query;
      
      if (error) {
        return {
          success: false,
          error: `Failed to query curriculum: ${error.message}`,
        };
      }
      
      if (!data || data.length === 0) {
        return {
          success: true,
          data: {
            topics: [],
            message: 'No curriculum topics found matching your criteria. Try a different grade, subject, or search term.',
            suggestions: [
              'Try searching for "Mathematics Grade 4"',
              'Search for topics like "fractions", "reading", or "plants"',
              'Specify a term (1-4) for seasonal topics',
            ],
          },
        };
      }
      
      // Format results
      const topics = data.map((topic: any) => {
        const base = {
          id: topic.id,
          grade: topic.grade,
          subject: topic.subject,
          code: topic.topic_code,
          title: topic.topic_title,
          term: topic.term,
          content: topic.content_outline,
          suggestedHours: topic.suggested_time_hours,
          cognitiveLevel: topic.cognitive_level,
        };
        
        if (params.include_details) {
          return {
            ...base,
            description: topic.description,
            learningOutcomes: topic.learning_outcomes,
            assessmentStandards: topic.assessment_standards,
            specificAims: topic.specific_aims,
            skillsToDevelop: topic.skills_to_develop,
            knowledgeAreas: topic.knowledge_areas,
            prerequisites: topic.prerequisites,
            capsReference: topic.caps_document_reference,
          };
        }
        
        return base;
      });
      
      return {
        success: true,
        data: {
          topics,
          count: topics.length,
          filters: {
            grade: params.grade || 'all',
            subject: params.subject || 'all',
            term: params.term || 'all',
          },
          message: `Found ${topics.length} curriculum topic${topics.length !== 1 ? 's' : ''}`,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Curriculum query failed: ${error.message}`,
      };
    }
  },
};

export { CAPSCurriculumTool };
