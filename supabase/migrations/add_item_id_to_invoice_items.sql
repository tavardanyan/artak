-- Add item_id column to invoice_items table as foreign key to item table
ALTER TABLE invoice_items
ADD COLUMN IF NOT EXISTS item_id BIGINT REFERENCES item(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_invoice_items_item_id ON invoice_items(item_id);

-- Create index on invoice_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
