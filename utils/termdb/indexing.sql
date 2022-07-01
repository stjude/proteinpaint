create index sidmap_id on sampleidmap(id);


update terms set parent_id=null where parent_id='';
create index terms_id on terms(id);
create index terms_p on terms(parent_id);
create index terms_n on terms(name);


create index ancestry_tid on ancestry(term_id);
create index ancestry_pid on ancestry(ancestor_id);


CREATE INDEX termhtmldef_id on termhtmldef(id);


create index a_sample on annotations(sample);
create index a_termid on annotations(term_id);
create index a_value on annotations(value);

create index c_sample on chronicevents(sample);
create index c_termid on chronicevents(term_id);
create index c_grade on chronicevents(grade);



CREATE INDEX p_sample on precomputed(sample);
CREATE INDEX p_termid on precomputed(term_id);
CREATE INDEX p_value_for on precomputed(value_for);



CREATE INDEX subcohort_terms_cohort ON subcohort_terms(cohort);
CREATE INDEX subcohort_terms_termid ON subcohort_terms(term_id);


CREATE INDEX survival_term ON survival(term_id);
CREATE INDEX survival_sample ON survival(sample);
