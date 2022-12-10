
-- TODO how to load up a field as "null" from flatfile so no need to run this line
update terms set parent_id=null where parent_id='';

create index terms_n on terms(name);
create index a_value on annotations(value);
create index c_grade on chronicevents(grade);
CREATE INDEX p_value_for on precomputed(value_for);
CREATE INDEX subcohort_terms_cohort ON subcohort_terms(cohort);
CREATE INDEX subcohort_terms_term_id ON subcohort_terms(term_id);

