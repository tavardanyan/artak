-- Items are identified by name + unit: the same name may exist with different
-- measurement units (e.g. "Ամրան" in կգ and հատ) as separate items.
-- Applied to production on 2026-07-03 (migration: item_unique_name_unit).
ALTER TABLE public.item DROP CONSTRAINT item_name_key;
ALTER TABLE public.item ADD CONSTRAINT item_name_unit_key UNIQUE NULLS NOT DISTINCT (name, unit);
