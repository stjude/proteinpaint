
-- TODO how to load up a field as "null" from flatfile so no need to run this line
update terms set parent_id=null where parent_id='';

create index terms_name on terms(name);

create index ancestry_pid on ancestry(ancestor_id);

create index annotations_sample on annotations(sample);
create index annotations_value on annotations(value);

create index chronicevents_sample on chronicevents(sample);
create index chronicevents_term_id on chronicevents(term_id);

create index chronicevents_grade on chronicevents(grade);

CREATE INDEX precomputed_sample on precomputed(sample);
create index precomputed_term_id on precomputed(term_id);
CREATE INDEX precomputed_value_for on precomputed(value_for);

CREATE INDEX subcohort_terms_cohort ON subcohort_terms(cohort);
CREATE INDEX subcohort_terms_termid ON subcohort_terms(term_id);

CREATE INDEX survival_sample ON survival(sample);

