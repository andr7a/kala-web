/*
  # Create cars table

  1. New Tables
    - `cars`
      - `id` (uuid, primary key) - unique identifier for each car
      - `lot_number` (text, unique) - lot number for the car
      - `make` (text) - car manufacturer
      - `model` (text) - car model name
      - `year` (integer) - manufacturing year
      - `odometer` (text) - mileage reading
      - `imageUrl` (text) - URL to car image
      - `created_at` (timestamptz) - timestamp when record was created
      - `updated_at` (timestamptz) - timestamp when record was last updated

  2. Security
    - Enable RLS on `cars` table
    - Add policy for anyone to read car data (public access)
    - Add policy for authenticated users to create/update cars (admin functionality)
*/

CREATE TABLE IF NOT EXISTS cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_number text UNIQUE NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  year integer NOT NULL,
  odometer text NOT NULL,
  imageUrl text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view cars"
  ON cars
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert cars"
  ON cars
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cars"
  ON cars
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete cars"
  ON cars
  FOR DELETE
  TO authenticated
  USING (true);

-- Insert sample car data
INSERT INTO cars (lot_number, make, model, year, odometer, imageUrl) VALUES
  ('LOT001', 'Toyota', 'Camry', 2020, '35,420 mi', 'https://images.pexels.com/photos/3849196/pexels-photo-3849196.jpeg'),
  ('LOT002', 'Honda', 'Accord', 2019, '42,150 mi', 'https://images.pexels.com/photos/1007410/pexels-photo-1007410.jpeg'),
  ('LOT003', 'Ford', 'Mustang', 2021, '18,500 mi', 'https://images.pexels.com/photos/544542/pexels-photo-544542.jpeg'),
  ('LOT004', 'Tesla', 'Model 3', 2022, '12,300 mi', 'https://images.pexels.com/photos/2036544/pexels-photo-2036544.jpeg'),
  ('LOT005', 'BMW', '3 Series', 2020, '28,900 mi', 'https://images.pexels.com/photos/1592384/pexels-photo-1592384.jpeg'),
  ('LOT006', 'Mercedes-Benz', 'C-Class', 2021, '22,100 mi', 'https://images.pexels.com/photos/3849553/pexels-photo-3849553.jpeg'),
  ('LOT007', 'Audi', 'A4', 2019, '45,600 mi', 'https://images.pexels.com/photos/2127733/pexels-photo-2127733.jpeg'),
  ('LOT008', 'Chevrolet', 'Malibu', 2020, '31,200 mi', 'https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg'),
  ('LOT009', 'Nissan', 'Altima', 2019, '38,700 mi', 'https://images.pexels.com/photos/3752169/pexels-photo-3752169.jpeg'),
  ('LOT010', 'Hyundai', 'Sonata', 2021, '15,400 mi', 'https://images.pexels.com/photos/2920064/pexels-photo-2920064.jpeg'),
  ('LOT011', 'Mazda', 'Mazda6', 2020, '27,800 mi', 'https://images.pexels.com/photos/3354540/pexels-photo-3354540.jpeg'),
  ('LOT012', 'Volkswagen', 'Passat', 2019, '41,500 mi', 'https://images.pexels.com/photos/1213294/pexels-photo-1213294.jpeg'),
  ('LOT013', 'Subaru', 'Legacy', 2021, '19,200 mi', 'https://images.pexels.com/photos/2920062/pexels-photo-2920062.jpeg'),
  ('LOT014', 'Kia', 'Optima', 2020, '33,600 mi', 'https://images.pexels.com/photos/3752167/pexels-photo-3752167.jpeg'),
  ('LOT015', 'Lexus', 'ES', 2022, '8,900 mi', 'https://images.pexels.com/photos/3849554/pexels-photo-3849554.jpeg'),
  ('LOT016', 'Acura', 'TLX', 2020, '29,400 mi', 'https://images.pexels.com/photos/3849167/pexels-photo-3849167.jpeg'),
  ('LOT017', 'Infiniti', 'Q50', 2019, '44,200 mi', 'https://images.pexels.com/photos/3752168/pexels-photo-3752168.jpeg'),
  ('LOT018', 'Cadillac', 'CT5', 2021, '16,700 mi', 'https://images.pexels.com/photos/3752170/pexels-photo-3752170.jpeg'),
  ('LOT019', 'Genesis', 'G70', 2020, '25,300 mi', 'https://images.pexels.com/photos/3849195/pexels-photo-3849195.jpeg'),
  ('LOT020', 'Volvo', 'S60', 2021, '21,800 mi', 'https://images.pexels.com/photos/3849197/pexels-photo-3849197.jpeg')
ON CONFLICT (lot_number) DO NOTHING;