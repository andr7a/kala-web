/*
  # Optimize RLS Policies for Better Performance

  1. Changes
    - Drop all existing RLS policies on user_profiles, favorite_cars, and saved_comparisons
    - Recreate policies with optimized auth.uid() calls using (select auth.uid())
    - This prevents re-evaluation of auth.uid() for each row, significantly improving query performance at scale

  2. Tables Affected
    - user_profiles: 3 policies (select, insert, update)
    - favorite_cars: 3 policies (select, insert, delete)
    - saved_comparisons: 4 policies (select, insert, update, delete)

  3. Security
    - All security constraints remain identical
    - Only the performance characteristics are improved
    - No change to authorization logic
*/

-- user_profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- favorite_cars policies
DROP POLICY IF EXISTS "Users can view own favorites" ON favorite_cars;
DROP POLICY IF EXISTS "Users can insert own favorites" ON favorite_cars;
DROP POLICY IF EXISTS "Users can delete own favorites" ON favorite_cars;

CREATE POLICY "Users can view own favorites"
  ON favorite_cars FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own favorites"
  ON favorite_cars FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own favorites"
  ON favorite_cars FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- saved_comparisons policies
DROP POLICY IF EXISTS "Users can view own comparisons" ON saved_comparisons;
DROP POLICY IF EXISTS "Users can insert own comparisons" ON saved_comparisons;
DROP POLICY IF EXISTS "Users can update own comparisons" ON saved_comparisons;
DROP POLICY IF EXISTS "Users can delete own comparisons" ON saved_comparisons;

CREATE POLICY "Users can view own comparisons"
  ON saved_comparisons FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own comparisons"
  ON saved_comparisons FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own comparisons"
  ON saved_comparisons FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own comparisons"
  ON saved_comparisons FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);
