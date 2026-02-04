/*
  # Create Favorite Cars Table

  1. New Tables
    - `favorite_cars`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - References user_profiles
      - `car_id` (text) - Car identifier from cars.json
      - `created_at` (timestamptz) - When favorited

  2. Security
    - Enable RLS on `favorite_cars` table
    - Add policy for users to view their own favorites
    - Add policy for users to insert their own favorites
    - Add policy for users to delete their own favorites

  3. Indexes
    - Add unique constraint on user_id + car_id combination
    - Add index on user_id for faster queries
*/

CREATE TABLE IF NOT EXISTS favorite_cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  car_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, car_id)
);

CREATE INDEX IF NOT EXISTS idx_favorite_cars_user_id ON favorite_cars(user_id);

ALTER TABLE favorite_cars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
  ON favorite_cars FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
  ON favorite_cars FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON favorite_cars FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
