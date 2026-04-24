-- Add is_favorite flag to files table for sorting documents
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;

ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS file_size BIGINT;

CREATE INDEX IF NOT EXISTS idx_files_project_favorite
  ON public.files(project_id, is_favorite DESC, created_at DESC);
