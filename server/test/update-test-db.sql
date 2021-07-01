ATTACH DATABASE db AS db0;

INSERT INTO terms
SELECT * FROM db0.terms t
WHERE t.id IN ('Genomic Profiling Status', 'wgs_curated');

INSERT INTO annotations
SELECT * FROM db0.annotations a
WHERE a.sample IN (select sample from samples)
AND a.term_id='wgs_curated';

INSERT INTO subcohort_terms
SELECT * FROM db0.subcohort_terms st
WHERE st.term_id IN ('Genomic Profiling Status', 'wgs_curated');

---

INSERT INTO terms
SELECT * FROM db0.terms t
WHERE t.id IN ('Race/Ethnicity', 'genetic_race');

INSERT INTO annotations
SELECT * FROM db0.annotations a
WHERE a.sample IN (select sample from samples)
AND a.term_id='genetic_race';

INSERT INTO subcohort_terms
SELECT * FROM db0.subcohort_terms st
WHERE st.term_id IN ('Race/Ethnicity', 'genetic_race');


---------------------------------------------
-- to build the survival table for testing
---------------------------------------------

INSERT INTO terms
VALUES('efs', 'Event-free survival', NULL, '{"type": "float"}', 100);

INSERT INTO terms
VALUES('os', 'Overall survival', NULL, '{"type": "float"}', 101);

DROP TABLE IF EXISTS survival;
DROP INDEX IF EXISTS survival_term;
DROP INDEX IF EXISTS survival_sample;
CREATE TABLE survival(
 sample INT,
 term_id TEXT,
 tte INT, -- time-to-event
 value INT -- cohort defined exit code, may be 0=death, 1=censored, or similar
);
CREATE INDEX survival_term ON survival(term_id);
CREATE INDEX survival_sample ON survival(sample);

INSERT INTO survival
SELECT sample, 'efs',  abs(random() % 20), abs(random() % 2) + 1
FROM samples;

INSERT INTO survival
SELECT sample, 'os',  abs(random() % 20), abs(random() % 2) + 1
FROM samples;

select count(*) from survival; -- should be 200, if we have 100 samples
