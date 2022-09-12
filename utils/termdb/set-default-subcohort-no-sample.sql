delete from subcohort_terms;

insert into subcohort_terms (cohort, term_id, count)
select '', t.id, 0
from terms t
-- no need to join to annotation or survival tables,
-- since there are no samples with annotation or survival data
group by t.id;

insert into subcohort_terms (cohort, term_id, count)
select '', p.ancestor_id, 0
from terms t
join ancestry p ON p.term_id = t.id
group by p.ancestor_id;
