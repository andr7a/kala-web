import { supabase, SINGLE_SESSION_LS_KEY } from './supabase';

/**
 * One-account / one-session implementation.
 *
 * How it works:
 *  - On login we generate a UUID session id and store it in localStorage.
 *  - We save that UUID into user_profiles.active_session_id via an RPC.
 *  - Every Supabase request includes header x-session-id, so RLS can enforce it.
 *  - We also verify on app boot and log the user out if their session is no longer active.
 */

export function getLocalSessionId(): string | null {
  const v = localStorage.getItem(SINGLE_SESSION_LS_KEY);
  return v && v.length > 0 ? v : null;
}

export function clearSingleSession() {
  localStorage.removeItem(SINGLE_SESSION_LS_KEY);
}

export async function startSingleSession(): Promise<string> {
  // IMPORTANT:
  // Do NOT generate a brand-new session id on every auth state change.
  // Supabase fires events like TOKEN_REFRESH periodically; if we rotate the
  // session id each time, two open browsers can keep kicking each other out
  // (ping-pong) and BOTH appear to "stop working".
  //
  // Instead, keep a stable session id per browser/device and only set it once.
  const existing = getLocalSessionId();
  const sessionId = existing ?? crypto.randomUUID();
  if (!existing) {
    localStorage.setItem(SINGLE_SESSION_LS_KEY, sessionId);
  }

  if (!supabase) {
    return sessionId;
  }

  const { error } = await supabase.rpc('set_active_session', {
    session_id: sessionId,
  });

  if (error) {
    // If RPC isn't installed yet, we keep the local session id but the server won't enforce.
    // eslint-disable-next-line no-console
    console.warn('[SingleSession] set_active_session RPC failed:', error.message);
  }

  return sessionId;
}

/**
 * Returns true if still valid. If invalid, signs out (and clears local session id) and returns false.
 */
export async function verifySingleSessionOrLogout(): Promise<boolean> {
  const localSessionId = getLocalSessionId();
  if (!localSessionId) return true;
  if (!supabase) return true;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('active_session_id')
    .maybeSingle();

  // If the table/column isn't present yet, don't hard-logout.
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[SingleSession] verify failed:', error.message);
    return true;
  }

  const dbSessionId = (data as any)?.active_session_id as string | null | undefined;
  if (!dbSessionId) return true;

  if (dbSessionId !== localSessionId) {
    await supabase.auth.signOut();
    clearSingleSession();
    return false;
  }

  return true;
}
