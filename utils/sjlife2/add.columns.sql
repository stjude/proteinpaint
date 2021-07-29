
---------------------------------------------
-- add columns to the terms table
---------------------------------------------

ALTER TABLE terms ADD COLUMN type TEXT;
ALTER TABLE terms ADD COLUMN isleaf INTEGER;
ALTER TABLE subcohort_terms ADD COLUMN included_types TEXT;
