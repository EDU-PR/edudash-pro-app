-- Active Sessions table for multi-device awareness (Option B: soft detection)
-- Tracks which devices a user is currently signed in on.
-- Does NOT enforce limits — just provides awareness + notification triggers.

CREATE TABLE IF NOT EXISTS public.active_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id text NOT NULL,
    device_name text,                        -- e.g. "OPPO CPH2669"
    platform text NOT NULL DEFAULT 'unknown', -- android, ios, web
    app_version text,
    ip_address inet,
    last_active_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    is_active boolean NOT NULL DEFAULT true,
    signed_out_at timestamptz,

    -- One row per user per device
    CONSTRAINT uq_active_sessions_user_device UNIQUE (user_id, device_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_active
    ON public.active_sessions (user_id)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_active_sessions_last_active
    ON public.active_sessions (last_active_at);

-- RLS: users can only see/manage their own sessions
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
    ON public.active_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
    ON public.active_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
    ON public.active_sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
    ON public.active_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- Super-admin bypass (service role can see all)
CREATE POLICY "Service role full access"
    ON public.active_sessions FOR ALL
    USING (auth.role() = 'service_role');

-- Cleanup function: mark stale sessions (inactive > 7 days) as signed out
CREATE OR REPLACE FUNCTION public.cleanup_stale_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.active_sessions
    SET is_active = false,
        signed_out_at = now()
    WHERE is_active = true
      AND last_active_at < now() - interval '7 days';
END;
$$;

-- RPC: register or refresh a device session, returns other active devices
CREATE OR REPLACE FUNCTION public.register_device_session(
    p_device_id text,
    p_device_name text DEFAULT NULL,
    p_platform text DEFAULT 'unknown',
    p_app_version text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_other_devices jsonb;
BEGIN
    -- Upsert this device session
    INSERT INTO public.active_sessions (
        user_id, device_id, device_name, platform, app_version, last_active_at, is_active
    )
    VALUES (
        v_user_id, p_device_id, p_device_name, p_platform, p_app_version, now(), true
    )
    ON CONFLICT (user_id, device_id)
    DO UPDATE SET
        device_name = COALESCE(EXCLUDED.device_name, active_sessions.device_name),
        platform = EXCLUDED.platform,
        app_version = EXCLUDED.app_version,
        last_active_at = now(),
        is_active = true,
        signed_out_at = NULL;

    -- Return other active devices for this user (excluding current)
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'device_id', s.device_id,
        'device_name', s.device_name,
        'platform', s.platform,
        'last_active_at', s.last_active_at
    )), '[]'::jsonb)
    INTO v_other_devices
    FROM public.active_sessions s
    WHERE s.user_id = v_user_id
      AND s.device_id != p_device_id
      AND s.is_active = true
      AND s.last_active_at > now() - interval '24 hours';

    RETURN jsonb_build_object(
        'other_devices', v_other_devices,
        'device_count', (SELECT count(*) FROM public.active_sessions
                         WHERE user_id = v_user_id AND is_active = true)
    );
END;
$$;

-- RPC: sign out a device session
CREATE OR REPLACE FUNCTION public.sign_out_device_session(
    p_device_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.active_sessions
    SET is_active = false,
        signed_out_at = now()
    WHERE user_id = auth.uid()
      AND device_id = p_device_id;
END;
$$;
