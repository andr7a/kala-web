/*
  # Fix column name casing

  1. Changes
    - Rename imageurl to imageUrl to match the application's expected format
    
  This ensures the API returns data in the format the frontend expects.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cars' AND column_name = 'imageurl'
  ) THEN
    ALTER TABLE cars RENAME COLUMN imageurl TO "imageUrl";
  END IF;
END $$;