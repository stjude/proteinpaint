UPDATE terms
SET isleaf=1 
WHERE jsondata LIKE '%"isleaf":1%'
OR jsondata LIKE '%"isleaf": 1%'
OR jsondata LIKE '%"isleaf":true%'
OR jsondata LIKE '%"isleaf": true%';

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

UPDATE subcohort_terms
SET included_types=(
SELECT GROUP_CONCAT(DISTINCT c.type) 
FROM terms c
JOIN ancestry a ON subcohort_terms.term_id IN (a.ancestor_id, a.term_id) AND a.term_id = c.id
JOIN subcohort_terms s ON s.cohort = subcohort_terms.cohort AND s.term_id = subcohort_terms.term_id
);
