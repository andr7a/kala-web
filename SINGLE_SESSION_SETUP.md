# Single-session login (one account = one active device)

This project now includes **frontend support** for single-session logins, and a **Supabase migration** that adds the required DB fields + RPC.

## 1) Run the migration in Supabase

In Supabase SQL editor, run the migration:
- `supabase/migrations/20260114120000_add_single_session.sql`

It adds:
- `user_profiles.active_session_id`
- `user_profiles.active_session_set_at`
- RPC `set_active_session(session_id uuid)`

## 2) OPTIONAL but recommended: enforce via RLS

If you want Supabase to *hard-block* old sessions (recommended), update your RLS policies to require `x-session-id`.

Example for a table that belongs to a user (`user_id` column):

```sql
-- Replace favorite_cars with the table name and user_id with your owner column.
-- You should apply the same check for SELECT / INSERT / UPDATE / DELETE policies.

CREATE POLICY "..." ON favorite_cars
FOR SELECT TO authenticated
USING (
  (select auth.uid()) = user_id
  AND EXISTS (
    SELECT 1
    FROM public.user_profiles p
    WHERE p.id = (select auth.uid())
      AND p.active_session_id = (current_setting('request.headers', true)::json ->> 'x-session-id')::uuid
  )
);
```

## 3) What changed in the frontend

- `src/lib/supabase.ts` attaches header `x-session-id` to every Supabase request.
- `src/lib/singleSession.ts` handles setting/verifying the session id.
- `src/context/AuthContext.tsx` now uses **Supabase Auth** and establishes a new active session on login.

Behavior:
- When the same user logs in from another browser/device, the `active_session_id` is replaced.
- The older session becomes invalid and will be signed out on next verification (and will be blocked at the DB level if you add the RLS check above).
