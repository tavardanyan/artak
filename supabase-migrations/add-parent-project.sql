-- Add parent_project column to project table for sub-project hierarchy
ALTER TABLE public.project
  ADD COLUMN IF NOT EXISTS parent_project BIGINT REFERENCES public.project(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_parent ON public.project(parent_project);
