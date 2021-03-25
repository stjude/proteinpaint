
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
with
m as ( 
select s.cohort, s.term_id as t0, s2.term_id as t1
from subcohort_terms s
left join subcohort_terms2 s2 on s.cohort = s2.cohort and s.term_id = s2.term_id
union all
select s2.cohort, s2.term_id as t0, s.term_id as t1
from subcohort_terms s2
left join subcohort_terms s on s.cohort = s2.cohort and s.term_id = s2.term_id
)
select cohort, t0 as term_id
from m
where t1 is null
group by cohort, t0
order by cohort, t0;


-- detect mismatched counts by cohort
select s1.cohort, s0.term_id, s0.count, s1.count 
from subcohort_terms s0, subcohort_terms2 s1
where s0.cohort = s1.cohort and s0.term_id = s1.term_id and s0.count != s1.count;
*/
