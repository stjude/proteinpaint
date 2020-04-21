
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

WITH 
ancestors AS (
  SELECT term_id, term_id AS tid
  FROM ancestry a
  JOIN terms t ON t.id = a.term_id
  UNION ALL
  SELECT term_id, ancestor_id as tid
  FROM ancestry a
  JOIN terms t ON t.id = a.term_id
  GROUP BY term_id, tid
  UNION ALL
  SELECT a.term_id as term_id, '$ROOT$' AS tid
  FROM ancestry a
  JOIN terms t ON a.ancestor_id = t.id AND t.parent_id IS NULL
  GROUP BY term_id, tid
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
  WHERE term_id NOT IN parentterms
  group by term_id, sample
),
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
  SELECT subcohort, tid, count(distinct(a.sample))
  FROM rawannos a
  JOIN ancestors p ON p.term_id = a.term_id
  JOIN cohort c ON c.sample = a.sample
  GROUP BY subcohort, tid
  UNION ALL
  SELECT 'SJLIFE,CCSS', tid, count(distinct(a.sample))
  FROM rawannos a
  JOIN ancestors p ON a.term_id IN sharedterms AND p.term_id = a.term_id
  JOIN cohort c ON c.sample = a.sample
  GROUP BY tid
)
INSERT INTO subcohort_terms SELECT * FROM combined; /*** to materialize ***/

CREATE INDEX subcohort_terms_cohort ON subcohort_terms(cohort);
CREATE INDEX subcohort_terms_termid ON subcohort_terms(term_id);
