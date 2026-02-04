/*
  # Create Saved Comparisons Table

  1. New Tables
    - `saved_comparisons`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - References user_profiles
      - `name` (text) - User-defined name for the comparison
      - `car_ids` (jsonb) - Array of car IDs being compared
      - `created_at` (timestamptz) - When comparison was saved
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `saved_comparisons` table
    - Add policy for users to view their own comparisons
    - Add policy for users to insert their own comparisons
    - Add policy for users to update their own comparisons
    - Add policy for users to delete their own comparisons

  3. Indexes
    - Add index on user_id for faster queries
*/

CREATE TABLE IF NOT EXISTS saved_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  car_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_comparisons_user_id ON saved_comparisons(user_id);

ALTER TABLE saved_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own comparisons"
  ON saved_comparisons FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own comparisons"
  ON saved_comparisons FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comparisons"
  ON saved_comparisons FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comparisons"
  ON saved_comparisons FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
