UPDATE subcohort_terms
SET included_types=(
SELECT GROUP_CONCAT(DISTINCT c.type) 
FROM terms c
JOIN ancestry a ON subcohort_terms.term_id IN (a.ancestor_id, a.term_id) AND a.term_id = c.id
JOIN subcohort_terms s ON s.cohort = subcohort_terms.cohort AND s.term_id = subcohort_terms.term_id
);
