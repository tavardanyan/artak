-- Add seen column to invoice table
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS seen BOOLEAN DEFAULT false;

-- Create index for faster queries on unseen invoices
CREATE INDEX IF NOT EXISTS idx_invoice_seen ON invoice(buyer_tin, seen) WHERE seen = false;
