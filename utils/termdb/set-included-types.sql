
--------------------------------------
-- populate the included_types column
--------------------------------------
UPDATE subcohort_terms
SET included_types=(
SELECT GROUP_CONCAT(DISTINCT c.type) 
FROM terms c
JOIN ancestry a ON subcohort_terms.term_id IN (a.ancestor_id, a.term_id) AND a.term_id = c.id AND c.type != ''
JOIN subcohort_terms s ON s.cohort = subcohort_terms.cohort AND s.term_id = c.id
);

alter table subcohort_terms add column child_types text;

UPDATE subcohort_terms
SET child_types=(
SELECT GROUP_CONCAT(DISTINCT c.type) 
FROM terms c
JOIN ancestry a ON subcohort_terms.term_id = a.ancestor_id AND a.term_id = c.id AND c.type != ''
JOIN subcohort_terms s ON s.cohort = subcohort_terms.cohort AND s.term_id = c.id
);
