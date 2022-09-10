delete from subcohort_terms;

insert into subcohort_terms (cohort, term_id, count)
select '', t.id, count(distinct a.sample)
from terms t
left join annotations a ON a.term_id = t.id
-- prevent unjoined terms from being returned for survival term,
-- which is done in the last pair of inserts, otherwise
-- both annotation and survival terms will be duplicated because of left join
where t.type != 'survival'
group by t.id;

insert into subcohort_terms (cohort, term_id, count)
select '', p.ancestor_id, count(distinct a.sample)
from terms t
left join annotations a ON a.term_id = t.id
join ancestry p ON p.term_id = t.id
-- see comment in the first insert statement above, do not duplicate survival ancestor entries
where t.type != 'survival'
group by p.ancestor_id;

insert into subcohort_terms (cohort, term_id, count)
select '', t.id, count(distinct s.sample)
from terms t
left join survival s ON s.term_id = t.id
-- see comment in the first insert statement above, do not duplicate annotation term entries
where t.type = 'survival'
group by t.id;

insert into subcohort_terms (cohort, term_id, count)
select '', p.ancestor_id, count(distinct s.sample)
from terms t
left join survival s ON s.term_id = t.id
join ancestry p ON p.term_id = t.id
-- see comment in the first insert statement above, do not duplicate annotation ancestor entries
where t.type = 'survival'
group by p.ancestor_id;
