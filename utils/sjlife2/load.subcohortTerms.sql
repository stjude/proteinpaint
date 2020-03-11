
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

WITH ancestors AS (
  SELECT term_id, term_id AS ancestor_id
  FROM ancestry
  UNION ALL
  SELECT term_id, ancestor_id
  FROM ancestry
  GROUP BY term_id, ancestor_id
),
cohort AS (
  SELECT value AS subcohort, sample
  FROM annotations
  WHERE term_id = 'subcohort'
  GROUP BY subcohort, sample
),
nonconditions AS (
  SELECT subcohort, ancestor_id, COUNT(DISTINCT(a.sample)) 
  FROM annotations a
  JOIN ancestors l ON l.term_id = a.term_id
  JOIN cohort c ON c.sample = a.sample
  GROUP BY subcohort, ancestor_id
),
conditions AS (
  SELECT subcohort, ancestor_id, COUNT(DISTINCT(a.sample)) 
  FROM precomputed a
  JOIN ancestors l ON l.term_id = a.term_id
  JOIN cohort c ON c.sample = a.sample
  GROUP BY subcohort, ancestor_id
),
combined AS (
  SELECT * FROM nonconditions
  UNION ALL
  SELECT * FROM conditions
)
-- select * from combined; /*** to test in command line ***/
INSERT INTO subcohort_terms SELECT * FROM combined; /*** to materialize ***/

CREATE INDEX subcohort_terms_cohort ON subcohort_terms(cohort);
CREATE INDEX subcohort_terms_termid ON subcohort_terms(term_id);


