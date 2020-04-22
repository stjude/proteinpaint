
---------------------------------------------
-- to build the subcohort_terms table
-- only required if cohort selection is enabled on the dataset
---------------------------------------------

DROP TABLE IF EXISTS subcohort_terms2;
DROP INDEX IF EXISTS subcohort_terms_cohort2;
DROP INDEX IF EXISTS subcohort_terms_termid2;
CREATE TABLE subcohort_terms2 (
 cohort TEXT,
 term_id TEXT,
 count INT
);
.mode tab
.import precompute.subcohort subcohort_terms2

CREATE INDEX subcohort_terms_cohort2 ON subcohort_terms2(cohort);
CREATE INDEX subcohort_terms_termid2 ON subcohort_terms2(term_id);

/*
-- detect missing terms by cohort
with sjl as (select term_id from subcohort_terms where cohort='SJLIFE') select cohort, term_id from subcohort_terms2 where cohort='SJLIFE' and term_id not in sjl;
with sjl as (select term_id from subcohort_terms where cohort='CCSS') select cohort, term_id from subcohort_terms2 where cohort='CCSS' and term_id not in sjl;
with sjl as (select term_id from subcohort_terms where cohort='SJLIFE,CCSS') select cohort, term_id from subcohort_terms2 where cohort='SJLIFE,CCSS' and term_id not in sjl;

-- detect mismatched counts by cohort
select s1.cohort, s0.term_id, s0.count, s1.count 
from subcohort_terms s0, subcohort_terms2 s1
where s0.cohort = s1.cohort and s0.term_id = s1.term_id and s0.count != s1.count;
*/
