-- Create ai_conversations table for Dash AI chat history
-- This table stores conversation threads for multi-tenant access with RLS

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Tenant isolation (CRITICAL)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preschool_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Conversation metadata
  conversation_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Dash AI Chat',
  
  -- Message history (JSONB array of messages)
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Summary and context
  summary TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- Constraints
  CONSTRAINT ai_conversations_user_preschool_conversation_key 
    UNIQUE (user_id, preschool_id, conversation_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id 
  ON public.ai_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_preschool_id 
  ON public.ai_conversations(preschool_id);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_conversation_id 
  ON public.ai_conversations(conversation_id);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated_at 
  ON public.ai_conversations(updated_at DESC);

-- Composite index for filtering
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_preschool_updated 
  ON public.ai_conversations(user_id, preschool_id, updated_at DESC);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_ai_conversations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_conversations_timestamp
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_conversations_timestamp();

-- Enable RLS
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own conversations
CREATE POLICY "Users can view own conversations"
  ON public.ai_conversations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own conversations
CREATE POLICY "Users can create own conversations"
  ON public.ai_conversations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations"
  ON public.ai_conversations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own conversations
CREATE POLICY "Users can delete own conversations"
  ON public.ai_conversations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.ai_conversations TO authenticated;
GRANT SELECT ON public.ai_conversations TO service_role;

-- Add helpful comment
COMMENT ON TABLE public.ai_conversations IS 
  'Stores Dash AI conversation threads with multi-tenant RLS isolation';
