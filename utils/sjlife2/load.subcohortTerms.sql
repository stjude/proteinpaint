
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
.import term2subcohort.txt subcohort_terms2

CREATE INDEX subcohort_terms_cohort2 ON subcohort_terms2(cohort);
CREATE INDEX subcohort_terms_termid2 ON subcohort_terms2(term_id);

select s1.cohort, s0.term_id, s0.count, s1.count 
from subcohort_terms s0, subcohort_terms2 s1
where s0.cohort = s1.cohort and s0.term_id = s1.term_id and s0.count != s1.count;



with sjl as (
select term_id 
from subcohort_terms 
where cohort='SJLIFE'
) 
select term_id, count 
from subcohort_terms2 
where cohort='SJLIFE' 
and term_id not in sjl;


WITH 
ancestors AS (
  SELECT term_id, ancestor_id as tid
  FROM ancestry a
  JOIN terms t ON t.id = a.term_id 
  WHERE ancestor_id = 'ctcae_graded'
),
cohort AS (
  SELECT value AS subcohort, sample
  FROM annotations
  WHERE term_id = 'subcohort'
  GROUP BY subcohort, sample
),
parentterms AS (
  SELECT distinct(ancestor_id)
  FROM ancestry
),
rawannos AS (
  SELECT term_id, sample
  FROM annotations
  group by term_id, sample
  UNION ALL
  SELECT term_id, sample
  FROM precomputed
  WHERE term_id NOT IN parentterms -- 6165, same count but slightly slower
  group by term_id, sample
)
select subcohort, count(distinct(a.sample))
from rawannos a
join cohort c on c.sample = a.sample 
-- constrain the term to only those known to be shared between sjlife and ccss
join subcohort_terms st on a.term_id = st.term_id AND st.cohort = 'SJLIFE,CCSS'
join ancestors p on p.term_id = a.term_id
group by subcohort;


sharedterms AS (
  SELECT distinct(term_id)
  FROM rawannos a
  JOIN cohort c ON c.sample = a.sample
  WHERE subcohort = 'SJLIFE' AND term_id NOT IN parentterms
  INTERSECT
  SELECT distinct(term_id)
  FROM rawannos a
  JOIN cohort c ON c.sample = a.sample
  WHERE subcohort = 'CCSS' AND term_id NOT IN parentterms
),
combined AS (
  SELECT 'SJLIFE,CCSS', tid, count(distinct(a.sample)) -- 6165
  -- SELECT 'SJLIFE,CCSS', tid, count(sample) -- 6305
  -- SELECT 'SJLIFE,CCSS', tid, count(*) -- 6305
  FROM rawannos a
  JOIN ancestors p ON a.term_id IN sharedterms AND p.term_id = a.term_id
  JOIN cohort c ON c.sample = a.sample
  GROUP BY tid
)
select * from combined;


WITH 
cohort AS (
SELECT value AS subcohort, sample
FROM annotations
WHERE term_id = 'subcohort'
GROUP BY subcohort, sample
)
select count(distinct(c0.sample)) 
from cohort c0 
join cohort c1 on c0.sample = c1.sample and c0.subcohort = 'SJLIFE' and c1.subcohort = 'CCSS';

