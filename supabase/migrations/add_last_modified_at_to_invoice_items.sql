-- Add last_modified_at column to invoice_items table
ALTER TABLE invoice_items
ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create or replace the trigger function (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_last_modified_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS invoice_items_last_modified ON invoice_items;
CREATE TRIGGER invoice_items_last_modified
  BEFORE UPDATE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_last_modified_at();
