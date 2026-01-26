-- Table for storing invoices from tax service (matches Armenian tax service API structure)
CREATE TABLE IF NOT EXISTS public.invoice (
  id TEXT PRIMARY KEY, -- Invoice ID from tax service

  -- Basic invoice info
  serial_no TEXT NULL, -- Invoice serial number
  type TEXT NULL, -- Invoice type: GOODS, EXCISE, SERVICES, LEASING, etc.
  sort TEXT NULL, -- Invoice sort/category

  -- Status and approval
  approval_state TEXT NULL, -- Approval state
  status TEXT NULL, -- Invoice status: DRAFT, ACTIVE, CANCELLED, etc.
  correction_state TEXT NULL, -- Correction state
  correction_type TEXT NULL, -- Type of correction if any

  -- Timestamps
  created_at TIMESTAMPTZ NULL, -- When invoice was created in tax service
  issued_at TIMESTAMPTZ NULL, -- When invoice was issued
  approved_at TIMESTAMPTZ NULL, -- When invoice was approved
  delivered_at TIMESTAMPTZ NULL, -- Delivery timestamp
  dealt_at TIMESTAMPTZ NULL, -- Deal timestamp
  cancelled_at TIMESTAMPTZ NULL, -- Cancellation timestamp
  last_modified_at VARCHAR NULL, -- Last modification timestamp

  -- Parties (TIN numbers)
  supplier_tin TEXT NULL, -- Supplier TIN number
  buyer_tin TEXT NULL, -- Buyer TIN number

  -- Addresses
  delivery_address TEXT NULL, -- Delivery address
  destination_address TEXT NULL, -- Destination address

  -- Financial data
  env_tax REAL NULL, -- Environmental tax
  total_value REAL NULL, -- Total value without VAT
  total_vat_amount REAL NULL, -- Total VAT amount
  total REAL NULL, -- Total amount including VAT

  -- Cancellation info
  cancellation_reason TEXT NULL, -- Reason for cancellation
  canceled_notified TEXT NULL, -- Cancellation notification status
  ben_canceled_notified TEXT NULL, -- Beneficiary cancellation notification
  ben_issued_notified TEXT NULL, -- Beneficiary issue notification

  -- User info
  user_name TEXT NULL, -- User who created/modified the invoice

  -- Flags
  final_use BOOLEAN NULL, -- Final use flag
  has_codes BOOLEAN NULL, -- Has product codes flag

  -- Additional data
  additional_info TEXT NULL, -- Additional information
  other_data TEXT NULL -- Other data/notes
) TABLESPACE pg_default;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoice_supplier_tin ON public.invoice USING btree (supplier_tin) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_invoice_buyer_tin ON public.invoice USING btree (buyer_tin) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_invoice_created_at ON public.invoice USING btree (created_at) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_invoice_status ON public.invoice USING btree (status) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_invoice_type ON public.invoice USING btree (type) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_invoice_serial_no ON public.invoice USING btree (serial_no) TABLESPACE pg_default;

-- Trigger to update last_modified_at timestamp
CREATE OR REPLACE FUNCTION update_last_modified_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified_at = NOW()::VARCHAR;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_last_modified
  BEFORE UPDATE ON public.invoice
  FOR EACH ROW
  EXECUTE FUNCTION update_last_modified_at();

-- Table for storing invoice line items (products/services)
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id SERIAL NOT NULL,
  invoice_id TEXT NOT NULL,

  -- Item details
  seq_no INTEGER NULL, -- Sequence number of item in invoice
  name TEXT NULL, -- Product/service name
  unit TEXT NULL, -- Unit of measurement

  -- Quantities and pricing
  quantity REAL NULL, -- Quantity
  unit_price REAL NULL, -- Price per unit
  total_value REAL NULL, -- Total value without VAT

  -- Classification and tax
  classifier_id TEXT NULL, -- Product classifier ID
  deal_type TEXT NULL, -- Type of deal
  vat_rate TEXT NULL, -- VAT rate
  vat_amount REAL NULL, -- VAT amount
  total REAL NULL, -- Total including VAT

  -- Additional costs
  inc_env_tax REAL NULL, -- Environmental tax included

  -- Additional data
  other_data TEXT NULL, -- Other data/notes

  CONSTRAINT invoice_items_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoice(id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Index for invoice_items
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items USING btree (invoice_id) TABLESPACE pg_default;

-- Trigger for invoice_items
CREATE TRIGGER invoice_items_last_modified
  BEFORE UPDATE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_last_modified_at();

-- Comments for documentation
COMMENT ON TABLE invoice IS 'Stores invoices synced from Armenian tax service e-invoicing system';
COMMENT ON TABLE invoice_items IS 'Stores line items (products/services) for each invoice';
COMMENT ON COLUMN invoice.supplier_tin IS 'Supplier TIN number - when this matches our TIN, we are the supplier (outgoing invoice)';
COMMENT ON COLUMN invoice.buyer_tin IS 'Buyer TIN number - when this matches our TIN, we are the buyer (incoming invoice)';
COMMENT ON COLUMN invoice.other_data IS 'Additional data/notes for this invoice';
COMMENT ON COLUMN invoice_items.seq_no IS 'Sequence number of item in the invoice';
COMMENT ON COLUMN invoice_items.classifier_id IS 'Product classifier ID from tax service';
