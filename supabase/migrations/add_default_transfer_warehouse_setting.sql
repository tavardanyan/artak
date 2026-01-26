-- Add default_transfer_warehouse setting for unknown transfers
INSERT INTO settings (key, value)
VALUES ('default_transfer_warehouse', '114')
ON CONFLICT (key) DO NOTHING;
