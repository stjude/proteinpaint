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
VALUES('Survival outcome', 'Survival outcome', NULL, '{"name": "Survival outcome"}', 1);

INSERT INTO terms
VALUES('efs', 'Event-free survival', 'Survival outcome', '{"type": "survival", "name": "Event-free survival", "isleaf": true}', 100);

INSERT INTO terms
VALUES('os', 'Overall survival', 'Survival outcome', '{"type": "survival", "name": "Overall survival", "isleaf": true}', 101);

DROP TABLE IF EXISTS survival;
DROP INDEX IF EXISTS survival_term;
DROP INDEX IF EXISTS survival_sample;
CREATE TABLE survival(
 sample INT,
 term_id TEXT,
 tte REAL, -- time-to-event
 value INT -- cohort defined exit code, may be 0=death, 1=censored, or similar
);
CREATE INDEX survival_term ON survival(term_id);
CREATE INDEX survival_sample ON survival(sample);

INSERT INTO survival
SELECT sample, 'efs',  22*(random()/2×9223372036854775808 + 0.5) + 3, abs(random() % 2) + 1
FROM samples;

INSERT INTO survival
SELECT sample, 'os',  22*(random()/2×9223372036854775808 + 0.5) + 3, abs(random() % 2) + 1
FROM samples;

select count(*) from survival; -- should be 200, if we have 100 samples


---------------------------------------------
-- to add columns to the terms table
---------------------------------------------

ALTER TABLE terms
ADD COLUMN type TEXT;

UPDATE terms
SET type='categorical' 
WHERE jsondata LIKE '%"type":"categorical"%';

UPDATE terms
SET type='integer' 
WHERE jsondata LIKE '%"type":"integer"%';

UPDATE terms
SET type='float' 
WHERE jsondata LIKE '%"type":"float"%';

UPDATE terms
SET type='condition' 
WHERE jsondata LIKE '%"type":"condition"%';

UPDATE terms
SET type='survival' 
WHERE jsondata LIKE '%"type":"survival"%';

ALTER TABLE subcohort_terms
ADD COLUMN included_types TEXT;

UPDATE subcohort_terms
SET included_types=(
SELECT GROUP_CONCAT(DISTINCT c.type) 
FROM terms c
JOIN ancestry a ON subcohort_terms.term_id IN (a.ancestor_id, a.term_id) AND a.term_id = c.id
JOIN subcohort_terms s ON s.cohort = subcohort_terms.cohort AND s.term_id = subcohort_terms.term_id
);

UPDATE terms
SET included_types=(
SELECT GROUP_CONCAT(DISTINCT c.type) 
FROM terms c
JOIN ancestry a ON (terms.id = a.ancestor_id AND a.term_id = c.id) OR (a.term_id = c.id AND terms.id = a.term_id)
);
