-- Create warehouse table
CREATE TABLE IF NOT EXISTS warehouse (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(500) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'main',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_warehouse_type ON warehouse(type);

-- Enable Row Level Security (RLS)
ALTER TABLE warehouse ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read all warehouses
CREATE POLICY "Allow authenticated users to read warehouses"
  ON warehouse
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy to allow authenticated users to insert warehouses
CREATE POLICY "Allow authenticated users to insert warehouses"
  ON warehouse
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create policy to allow authenticated users to update warehouses
CREATE POLICY "Allow authenticated users to update warehouses"
  ON warehouse
  FOR UPDATE
  TO authenticated
  USING (true);

-- Create policy to allow authenticated users to delete warehouses
CREATE POLICY "Allow authenticated users to delete warehouses"
  ON warehouse
  FOR DELETE
  TO authenticated
  USING (true);

-- Insert sample data (optional)
INSERT INTO warehouse (name, address, type) VALUES
  ('Կենտրոնական պահեստ', 'Երևան, Արշակունյաց 12', 'main'),
  ('Երկրորդական պահեստ', 'Երևան, Մաշտոցի 25', 'secondary'),
  ('Ժամանակավոր պահեստ', 'Երևան, Բագրատունյաց 5', 'temporary')
ON CONFLICT DO NOTHING;
