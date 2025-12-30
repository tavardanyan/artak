-- Create item table
CREATE TABLE IF NOT EXISTS item (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  unit VARCHAR(50) DEFAULT 'հատ',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_item_code ON item(code);
CREATE INDEX IF NOT EXISTS idx_item_name ON item(name);

-- Enable Row Level Security (RLS)
ALTER TABLE item ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to read items"
  ON item
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert items"
  ON item
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update items"
  ON item
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to delete items"
  ON item
  FOR DELETE
  TO authenticated
  USING (true);

-- Insert sample data (optional)
INSERT INTO item (name, code, description, unit) VALUES
  ('Ցեմենտ', 'CEM001', 'Շինարարական ցեմենտ M400', 'պարկ'),
  ('Աղյուս', 'BRK001', 'Կարմիր աղյուս', 'հատ'),
  ('Ավազ', 'SND001', 'Շինարարական ավազ', 'մ³'),
  ('Խիճ', 'GRV001', 'Խիճ 5-20մմ', 'մ³'),
  ('Երկաթ Ø12', 'RBR012', 'Երկաթբետոնե ձող Ø12մմ', 'մ')
ON CONFLICT (code) DO NOTHING;
