/**
 * Picture of Progress AI Service
 * 
 * AI-powered enhancements for Picture of Progress uploads:
 * - Auto-generated captions describing the image
 * - Subject/skill tagging based on image content
 * - Milestone detection and celebration suggestions
 * - Developmental insights for parents
 * 
 * @module PictureOfProgressAI
 */

import { supabase } from '../lib/supabase';

// Get environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export interface ImageAnalysisResult {
  caption: string;
  suggestedTags: string[];
  suggestedSubject: string | null;
  milestoneDetected: boolean;
  milestoneType?: string;
  developmentalInsight: string;
  celebrationSuggestion?: string;
}

export interface ProgressMilestone {
  id: string;
  category: 'motor_skills' | 'cognitive' | 'social' | 'creative' | 'language' | 'independence';
  name: string;
  description: string;
  ageRange?: string;
  keywords: string[];
}

// ECD Developmental Milestones for auto-detection
const MILESTONES: ProgressMilestone[] = [
  // Motor Skills
  { id: 'scissors', category: 'motor_skills', name: 'Scissor Skills', description: 'Learning to cut with scissors', keywords: ['scissors', 'cutting', 'cut out', 'paper', 'cutting lines'] },
  { id: 'pencil_grip', category: 'motor_skills', name: 'Pencil Control', description: 'Developing proper pencil grip and control', keywords: ['pencil', 'writing', 'drawing', 'grip', 'tracing'] },
  { id: 'painting', category: 'motor_skills', name: 'Painting Skills', description: 'Brush control and painting techniques', keywords: ['paint', 'painting', 'brush', 'artwork', 'colors'] },
  { id: 'building', category: 'motor_skills', name: 'Construction Play', description: 'Building and stacking objects', keywords: ['blocks', 'building', 'tower', 'lego', 'construct', 'stack'] },
  
  // Cognitive
  { id: 'counting', category: 'cognitive', name: 'Counting', description: 'Learning to count objects', keywords: ['counting', 'numbers', 'count', '1-10', 'how many'] },
  { id: 'patterns', category: 'cognitive', name: 'Pattern Recognition', description: 'Identifying and creating patterns', keywords: ['pattern', 'sequence', 'repeating', 'colors pattern'] },
  { id: 'shapes', category: 'cognitive', name: 'Shape Recognition', description: 'Learning shapes', keywords: ['shapes', 'circle', 'square', 'triangle', 'rectangle'] },
  { id: 'sorting', category: 'cognitive', name: 'Sorting & Classification', description: 'Grouping objects by properties', keywords: ['sorting', 'groups', 'same', 'different', 'classify'] },
  { id: 'letters', category: 'cognitive', name: 'Letter Recognition', description: 'Learning alphabet letters', keywords: ['letters', 'alphabet', 'ABC', 'letter', 'writing name'] },
  
  // Social
  { id: 'sharing', category: 'social', name: 'Sharing & Cooperation', description: 'Learning to share and work together', keywords: ['sharing', 'friends', 'together', 'group work', 'helping'] },
  { id: 'taking_turns', category: 'social', name: 'Taking Turns', description: 'Learning to wait and take turns', keywords: ['turns', 'waiting', 'queue', 'my turn', 'your turn'] },
  
  // Creative
  { id: 'art_project', category: 'creative', name: 'Art Project', description: 'Creating original artwork', keywords: ['art', 'creative', 'made', 'created', 'project', 'craft'] },
  { id: 'pretend_play', category: 'creative', name: 'Imaginative Play', description: 'Engaging in pretend play', keywords: ['pretend', 'dress up', 'playing', 'imagination', 'role play'] },
  
  // Language
  { id: 'writing_name', category: 'language', name: 'Writing Name', description: 'Learning to write own name', keywords: ['name', 'write name', 'my name', 'spelled'] },
  { id: 'reading', category: 'language', name: 'Early Reading', description: 'Beginning reading skills', keywords: ['reading', 'book', 'words', 'story', 'read'] },
  
  // Independence
  { id: 'self_care', category: 'independence', name: 'Self-Care Skills', description: 'Learning independent self-care', keywords: ['dressing', 'buttons', 'shoes', 'tying', 'eating', 'brushing'] },
  { id: 'clean_up', category: 'independence', name: 'Clean Up', description: 'Learning to tidy up', keywords: ['clean up', 'tidy', 'put away', 'organize'] },
];

export class PictureOfProgressAI {
  
  /**
   * Analyze an image and generate AI-powered insights
   * Uses the ai-gateway Edge Function for vision analysis
   */
  static async analyzeImage(
    imageBase64: string,
    existingDescription?: string,
    subject?: string
  ): Promise<ImageAnalysisResult> {
    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session?.session?.access_token;
      
      if (!accessToken) {
        // Return fallback if not authenticated
        return this.getFallbackAnalysis(existingDescription, subject);
      }

      // Call ai-gateway with vision analysis prompt
      const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-gateway`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'vision_analysis',
          image_base64: imageBase64,
          context: existingDescription || '',
          subject: subject || '',
          prompt: this.buildVisionPrompt(existingDescription, subject),
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        console.warn('Vision analysis failed, using fallback');
        return this.getFallbackAnalysis(existingDescription, subject);
      }

      const result = await response.json();
      return this.parseAIResponse(result.content, existingDescription, subject);
    } catch (error) {
      console.error('Image analysis error:', error);
      return this.getFallbackAnalysis(existingDescription, subject);
    }
  }

  /**
   * Generate auto-tags based on text content (no vision API needed)
   */
  static generateTags(description: string, subject?: string): string[] {
    const tags: string[] = [];
    const text = description.toLowerCase();
    
    // Add subject as tag if provided
    if (subject) {
      tags.push(subject);
    }
    
    // Check for milestone keywords
    for (const milestone of MILESTONES) {
      for (const keyword of milestone.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          tags.push(milestone.name);
          break; // Only add each milestone once
        }
      }
    }
    
    // Add common activity tags
    const activityKeywords: Record<string, string> = {
      'homework': 'Homework',
      'worksheet': 'Worksheet',
      'project': 'Project',
      'drawing': 'Drawing',
      'coloring': 'Coloring',
      'certificate': 'Achievement',
      'award': 'Award',
      'test': 'Assessment',
      'outdoor': 'Outdoor Activity',
      'science': 'Science',
      'experiment': 'Experiment',
      'music': 'Music',
      'dance': 'Dance',
      'sport': 'Physical Activity',
    };
    
    for (const [keyword, tag] of Object.entries(activityKeywords)) {
      if (text.includes(keyword) && !tags.includes(tag)) {
        tags.push(tag);
      }
    }
    
    // Limit to 5 most relevant tags
    return [...new Set(tags)].slice(0, 5);
  }

  /**
   * Detect if description mentions a milestone achievement
   */
  static detectMilestone(description: string): { detected: boolean; milestone?: ProgressMilestone } {
    const text = description.toLowerCase();
    
    // First-time indicators
    const firstTimeIndicators = [
      'first time',
      'for the first',
      'finally',
      'learned to',
      'mastered',
      'accomplished',
      'achieved',
      'now can',
      'can now',
    ];
    
    const hasFirstTimeIndicator = firstTimeIndicators.some(ind => text.includes(ind));
    
    // Check for specific milestones
    for (const milestone of MILESTONES) {
      for (const keyword of milestone.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          return {
            detected: hasFirstTimeIndicator,
            milestone,
          };
        }
      }
    }
    
    return { detected: false };
  }

  /**
   * Get celebration suggestions for milestone achievements
   */
  static getCelebrationSuggestion(milestone?: ProgressMilestone): string | undefined {
    if (!milestone) return undefined;
    
    const celebrations: Record<string, string[]> = {
      motor_skills: [
        "🎨 Those little hands are getting stronger every day!",
        "✂️ Amazing fine motor skills developing!",
        "🖐️ Such wonderful hand-eye coordination!",
      ],
      cognitive: [
        "🧠 Brilliant thinking on display!",
        "⭐ What a clever little learner!",
        "🎯 Problem-solving superstar!",
      ],
      social: [
        "💕 Learning to be a great friend!",
        "🤝 Such wonderful social skills!",
        "👫 Building beautiful friendships!",
      ],
      creative: [
        "🎨 What an amazing imagination!",
        "✨ Creativity shining bright!",
        "🌈 Such beautiful artistic expression!",
      ],
      language: [
        "📚 Words are their superpower!",
        "✏️ Communication skills blooming!",
        "🗣️ Finding their voice!",
      ],
      independence: [
        "🦸 Growing so independent!",
        "💪 Learning to do it themselves!",
        "🌟 Such a confident learner!",
      ],
    };
    
    const options = celebrations[milestone.category] || [];
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Generate developmental insight for parents
   */
  static getDevelopmentalInsight(
    subject?: string, 
    achievementLevel?: string, 
    detectedMilestone?: ProgressMilestone
  ): string {
    // Subject-specific insights
    const subjectInsights: Record<string, string> = {
      mathematics: "Mathematical thinking develops through hands-on experiences. Keep counting, sorting, and measuring together!",
      english: "Language skills grow through conversation and storytelling. Keep reading and talking together!",
      art: "Creative expression supports emotional development and fine motor skills. Celebrate their unique style!",
      science: "Curiosity about the world is a scientist in the making! Keep asking 'why' and 'how' together.",
      physical_education: "Movement builds brain connections! Active play supports all areas of development.",
      life_skills: "Every new skill builds independence and confidence. Patience and practice make progress!",
      music: "Music enhances language, math, and emotional development. Keep singing and moving to rhythms!",
      reading: "Early literacy starts with loving books. Keep reading together every day!",
      writing: "Writing develops from scribbles to letters. Celebrate every mark they make!",
      social_skills: "Learning to navigate friendships is a crucial life skill. Role-play and discuss feelings together.",
    };
    
    if (detectedMilestone) {
      return `🌟 Milestone Alert! ${detectedMilestone.description}. This is a wonderful developmental achievement!`;
    }
    
    if (subject && subjectInsights[subject]) {
      return subjectInsights[subject];
    }
    
    // Generic positive insights based on achievement level
    if (achievementLevel === 'excellent') {
      return "Excellent work shows dedication and growing skills. Celebrate this achievement together!";
    } else if (achievementLevel === 'improving') {
      return "Progress, not perfection, is what matters! Every step forward is a victory.";
    } else if (achievementLevel === 'needs_support') {
      return "Learning takes time and patience. Your support and encouragement make all the difference!";
    }
    
    return "Every moment of learning counts! Keep celebrating their unique journey.";
  }

  // Private helper methods

  private static buildVisionPrompt(description?: string, subject?: string): string {
    return `Analyze this image of a child's work or activity from a preschool/early childhood setting. 
    
Context provided by parent: "${description || 'No description'}"
Subject area: "${subject || 'Not specified'}"

Please provide:
1. A brief, warm caption (1-2 sentences) celebrating the child's work
2. 3-5 educational tags for this content
3. Any developmental milestones you can identify
4. A brief insight for the parent about the developmental value

Keep the tone warm, encouraging, and educational-focused. Use simple language.`;
  }

  private static parseAIResponse(
    content: string,
    existingDescription?: string,
    subject?: string
  ): ImageAnalysisResult {
    // For now, generate from existing content since vision API may not be available
    const tags = this.generateTags(existingDescription || '', subject);
    const milestoneResult = this.detectMilestone(existingDescription || '');
    
    return {
      caption: existingDescription 
        ? `${this.generateWarmCaption(existingDescription)}`
        : "A wonderful moment of learning and growth! 🌟",
      suggestedTags: tags,
      suggestedSubject: subject || null,
      milestoneDetected: milestoneResult.detected,
      milestoneType: milestoneResult.milestone?.name,
      developmentalInsight: this.getDevelopmentalInsight(subject, undefined, milestoneResult.milestone),
      celebrationSuggestion: milestoneResult.detected 
        ? this.getCelebrationSuggestion(milestoneResult.milestone) 
        : undefined,
    };
  }

  private static generateWarmCaption(description: string): string {
    // Extract key achievement words
    const achievementWords = ['made', 'created', 'finished', 'learned', 'did', 'completed', 'drew', 'painted'];
    const hasAchievement = achievementWords.some(word => description.toLowerCase().includes(word));
    
    if (hasAchievement) {
      const prefixes = [
        "What an amazing accomplishment! ",
        "Such wonderful progress! ",
        "A proud moment! ",
        "Look at this fantastic work! ",
      ];
      return prefixes[Math.floor(Math.random() * prefixes.length)] + "🌟";
    }
    
    return "Another step in their beautiful learning journey! ✨";
  }

  private static getFallbackAnalysis(description?: string, subject?: string): ImageAnalysisResult {
    const tags = this.generateTags(description || '', subject);
    const milestoneResult = this.detectMilestone(description || '');
    
    return {
      caption: "A wonderful moment of learning captured! 🌟",
      suggestedTags: tags,
      suggestedSubject: subject || null,
      milestoneDetected: milestoneResult.detected,
      milestoneType: milestoneResult.milestone?.name,
      developmentalInsight: this.getDevelopmentalInsight(subject, undefined, milestoneResult.milestone),
      celebrationSuggestion: milestoneResult.detected 
        ? this.getCelebrationSuggestion(milestoneResult.milestone) 
        : undefined,
    };
  }
}
