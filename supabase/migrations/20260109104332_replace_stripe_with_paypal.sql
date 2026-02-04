/*
  # Replace Stripe Fields with PayPal Fields

  1. Changes to Tables
    - `user_profiles`
      - Remove `stripe_customer_id` column
      - Remove `stripe_subscription_id` column
      - Add `paypal_subscription_id` (text) - PayPal subscription reference

  2. Security
    - No changes to RLS policies

  3. Notes
    - Existing subscription data will be preserved
    - PayPal subscriptions use subscription IDs instead of separate customer IDs
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE user_profiles DROP COLUMN stripe_customer_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE user_profiles DROP COLUMN stripe_subscription_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'paypal_subscription_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN paypal_subscription_id text;
  END IF;
END $$;