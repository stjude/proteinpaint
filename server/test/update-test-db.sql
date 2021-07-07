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
