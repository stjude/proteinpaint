
--------------------------------------
-- populate the included_types column
--------------------------------------

-- 1. ensure that the *_types columns start as empty strings
UPDATE subcohort_terms
SET included_types='', child_types='';

-- 2. set included_types to just the term's type  --
-- will add non-empty child_types later --
UPDATE subcohort_terms
SET included_types=(
SELECT type
FROM terms t
WHERE t.id=subcohort_terms.term_id
);

-- 3. alter table subcohort_terms add column child_types text;
UPDATE subcohort_terms
SET child_types=COALESCE(
(
SELECT GROUP_CONCAT(type)
FROM 
(
SELECT DISTINCT(c.type) as type
FROM terms c
JOIN ancestry a ON subcohort_terms.term_id = a.ancestor_id AND a.term_id = c.id AND c.type != ''
JOIN subcohort_terms s ON s.cohort = subcohort_terms.cohort AND s.term_id = c.id
)
),'');

-- 4. alter table subcohort_terms add column self.type + child_types (if not empty)
UPDATE subcohort_terms
SET included_types=included_types || ',' || child_types
WHERE child_types != '' AND child_types NOT LIKE '%'|| included_types ||'%';
