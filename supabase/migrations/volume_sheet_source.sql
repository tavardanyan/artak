-- Keep the original uploaded XLSX and each row's source position so that
-- Կատարողական exports can patch qty values into a byte-identical copy.
alter table volume_sheet add column file_path text;
alter table volume_sheet_row add column src_row int;
