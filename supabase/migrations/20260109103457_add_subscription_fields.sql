/*
  # Add Subscription Fields to User Profiles

  1. Changes to Tables
    - `user_profiles`
      - Add `subscription_status` (text) - Status: free, active, cancelled, past_due
      - Add `subscription_tier` (text) - Tier: free, premium
      - Add `stripe_customer_id` (text) - Stripe customer reference
      - Add `stripe_subscription_id` (text) - Stripe subscription reference
      - Add `subscription_start_date` (timestamptz) - When subscription started
      - Add `subscription_end_date` (timestamptz) - When subscription ends/renews

  2. Security
    - No changes to RLS policies needed
    - Users can still only read/update their own profile

  3. Notes
    - Default subscription_status is 'free' for new users
    - Default subscription_tier is 'free' for new users
    - Stripe fields are nullable until user subscribes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN subscription_status text DEFAULT 'free';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN subscription_tier text DEFAULT 'free';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN stripe_customer_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN stripe_subscription_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'subscription_start_date'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN subscription_start_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'subscription_end_date'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN subscription_end_date timestamptz;
  END IF;
END $$;