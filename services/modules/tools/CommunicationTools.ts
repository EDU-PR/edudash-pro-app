/**
 * Communication Tools for Dash AI
 * 
 * Tools for communication: PDF export, email sending, message composition
 */

import { logger } from '@/lib/logger';
import type { AgentTool } from '../DashToolRegistry';

export function registerCommunicationTools(register: (tool: AgentTool) => void): void {
  
  // Message composition tool
  register({
    name: 'compose_message',
    description: 'Open message composer with pre-filled content for sending to parents or teachers',
    parameters: {
      type: 'object',
      properties: {
        subject: { 
          type: 'string',
          description: 'Message subject line'
        },
        body: { 
          type: 'string',
          description: 'Message body content'
        },
        recipient: { 
          type: 'string', 
          description: 'Recipient type: "parent" or "teacher"'
        }
      },
      required: ['subject', 'body']
    },
    risk: 'low',
    execute: async (args) => {
      try {
        const router = (await import('expo-router')).router;
        
        // Navigate to messages screen with pre-filled content
        router.push({
          pathname: '/messages',
          params: {
            compose: 'true',
            subject: args.subject,
            body: args.body,
            recipient: args.recipient || ''
          }
        } as any);
        
        return { 
          success: true, 
          opened: true,
          message: 'Message composer opened'
        };
      } catch (error) {
        logger.error('[compose_message] Error:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to open composer' 
        };
      }
    }
  });

  // PDF export tool
  register({
    name: 'export_pdf',
    description: 'Export provided title and markdown/text content as a PDF and return a link',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Document title' },
        content: { type: 'string', description: 'Document body (markdown supported)' }
      },
      required: ['title', 'content']
    },
    risk: 'low',
    execute: async (args) => {
      try {
        const { getDashPDFGenerator } = await import('@/services/DashPDFGenerator');
        const supabase = (await import('@/lib/supabase')).assertSupabase();

        const generator = getDashPDFGenerator();
        const result = await generator.generateFromStructuredData({
          type: 'general',
          title: String(args.title || 'Document'),
          sections: [
            { id: 'main', title: 'Content', markdown: String(args.content || '') }
          ],
        });

        if (!result.success) {
          return { success: false, error: result.error || 'PDF generation failed' };
        }

        let publicUrl: string | undefined;
        if (result.storagePath) {
          try {
            const { data } = supabase.storage
              .from('generated-pdfs')
              .getPublicUrl(result.storagePath);
            publicUrl = data?.publicUrl || undefined;
          } catch {}
        }

        // Post a friendly assistant message into the current Dash Chat conversation
        try {
          const { DashAIAssistant } = await import('@/services/dash-ai/DashAICompat');
          const dash = DashAIAssistant.getInstance();
          const convId = dash.getCurrentConversationId?.();
          const link = publicUrl || result.uri;
          if (convId && link) {
            const msg = {
              id: `pdf_${Date.now()}`,
              type: 'assistant',
              content: `Your PDF is ready: [Open PDF](${link})`,
              timestamp: Date.now(),
              metadata: {
                suggested_actions: ['export_pdf'],
                dashboard_action: { type: 'export_pdf', title: args.title, content: args.content },
                tool_results: { tool: 'export_pdf', filename: result.filename, storagePath: result.storagePath, publicUrl: publicUrl }
              }
            } as any;
            await dash.addMessageToConversation(convId, msg);
          }
        } catch (postErr) {
          console.warn('[export_pdf] Failed to post chat message:', postErr);
        }

        return {
          success: true,
          uri: result.uri,
          filename: result.filename,
          storagePath: result.storagePath,
          publicUrl,
          message: 'PDF generated successfully',
        };
      } catch (e: any) {
        return { success: false, error: e?.message || 'PDF export failed' };
      }
    }
  });

  // Email sending tool (HIGH RISK - requires explicit confirmation)
  register({
    name: 'send_email',
    description: 'Send an email to one or more recipients. REQUIRES explicit user confirmation. Only principals and teachers can send emails.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address (or comma-separated addresses)'
        },
        subject: {
          type: 'string',
          description: 'Email subject line'
        },
        body: {
          type: 'string',
          description: 'Email body content (HTML supported)'
        },
        reply_to: {
          type: 'string',
          description: 'Optional reply-to email address'
        },
        is_html: {
          type: 'boolean',
          description: 'Whether body contains HTML (default: true)'
        }
      },
      required: ['to', 'subject', 'body']
    },
    risk: 'high',
    requiresConfirmation: true,
    execute: async (args) => {
      try {
        const supabase = (await import('@/lib/supabase')).assertSupabase();
        
        const { data, error } = await supabase.functions.invoke('send-email', {
          body: {
            to: args.to.includes(',') ? args.to.split(',').map((e: string) => e.trim()) : args.to,
            subject: args.subject,
            body: args.body,
            reply_to: args.reply_to,
            is_html: args.is_html !== false,
            confirmed: true
          }
        });
        
        if (error) {
          logger.error('[send_email] Edge Function error:', error);
          return { 
            success: false, 
            error: error.message || 'Failed to send email' 
          };
        }
        
        if (!data.success) {
          return {
            success: false,
            error: data.error || 'Email sending failed',
            rate_limit: data.rate_limit
          };
        }
        
        return {
          success: true,
          message_id: data.message_id,
          message: `Email sent successfully to ${args.to}`,
          rate_limit: data.rate_limit,
          warning: data.warning
        };
      } catch (error) {
        logger.error('[send_email] Tool execution error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  });
}
