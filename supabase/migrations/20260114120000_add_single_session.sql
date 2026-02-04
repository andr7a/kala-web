/*
  # Enforce single active session per account

  Adds server-side support for "one account = one active session".

  What it adds:
    - user_profiles.active_session_id (uuid)
    - user_profiles.active_session_set_at (timestamptz)
    - RPC: public.set_active_session(session_id uuid)

  NOTE:
    For full enforcement, update your RLS policies to require the request header
    `x-session-id` to match user_profiles.active_session_id.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'active_session_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN active_session_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'active_session_set_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN active_session_set_at timestamptz DEFAULT now();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_active_session(session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_profiles
    SET active_session_id = session_id,
        active_session_set_at = now()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    -- If profile row doesn't exist yet, create a minimal one.
    INSERT INTO public.user_profiles (id, email, display_name, avatar_url, subscription_status, subscription_tier, active_session_id, active_session_set_at)
    VALUES (auth.uid(), '', '', '', 'free', 'free', session_id, now());
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_active_session(uuid) TO authenticated;
