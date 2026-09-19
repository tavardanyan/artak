-- Signed scan verification for Կատարողական docs: once the uploaded PDF is
-- AI-verified to match the act, the doc is locked (checked_at set).
alter table completion_doc add column signed_file_path text;
alter table completion_doc add column checked_at timestamptz;
