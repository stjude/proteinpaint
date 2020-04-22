
---------------------------------------------
-- to build the subcohort_terms table
-- only required if cohort selection is enabled on the dataset
---------------------------------------------

DROP TABLE IF EXISTS subcohort_terms;
DROP INDEX IF EXISTS subcohort_terms_cohort;
DROP INDEX IF EXISTS subcohort_terms_termid;
CREATE TABLE subcohort_terms (
 cohort TEXT,
 term_id TEXT,
 count INT
);
.mode tab
.import precompute.subcohort.txt subcohort_terms

CREATE INDEX subcohort_terms_cohort ON subcohort_terms(cohort);
CREATE INDEX subcohort_terms_termid ON subcohort_terms(term_id);
