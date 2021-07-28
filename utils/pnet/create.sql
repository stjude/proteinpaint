drop index if exists sidmap_id;
drop table if exists sampleidmap;
create table sampleidmap (
  id integer not null,
  name character varying(100) not null
);
create index sidmap_id on sampleidmap(id);


drop index if exists terms_id;
drop index if exists terms_p;
drop index if exists terms_n;
drop table if exists terms;
create table terms (
  id character varying(100) not null,
  name character varying(100) not null,
  parent_id character varying(100),
  jsondata json not null,
  child_order integer not null
);
update terms set parent_id=null where parent_id='';
create index terms_id on terms(id);
create index terms_p on terms(parent_id);
create index terms_n on terms(name);


drop index if exists ancestry_tid;
drop index if exists ancestry_pid;
drop table if exists ancestry;
create table ancestry (
  term_id character varying(100) not null,
  ancestor_id character varying(100) not null
);

create index ancestry_tid on ancestry(term_id);
create index ancestry_pid on ancestry(ancestor_id);


-- may add term group and color etc
drop table if exists alltermsbyorder;
create table alltermsbyorder (
  group_name character not null,
  id character varying(100) not null
);


DROP TABLE IF EXISTS termhtmldef;
DROP INDEX IF EXISTS termhtmldef_id;
CREATE TABLE termhtmldef (
  id character not null,
  jsonhtml json not null
);
CREATE INDEX termhtmldef_id on termhtmldef(id);


drop table if exists category2vcfsample;
create table category2vcfsample (
  subcohort character not null,
  group_name character not null,
  term_id character varying(100) not null,
  parent_name character varying(200) null,
  q text not null,
  categories text not null
);


drop table if exists annotations;
drop index if exists a_sample;
drop index if exists a_termid;
drop index if exists a_value;
create table annotations (
  sample integer not null,
  term_id character varying(100) not null,
  value character varying(255) not null
);


create index a_sample on annotations(sample);
create index a_termid on annotations(term_id);
create index a_value on annotations(value);


drop table if exists chronicevents;
drop index if exists c_sample;
drop index if exists c_termid;
drop index if exists c_grade;
create table chronicevents (
  sample integer not null,
  term_id character varying(100) not null,
  grade integer not null,
  age_graded real not null,
  years_to_event real not null
);

create index c_sample on chronicevents(sample);
create index c_termid on chronicevents(term_id);
create index c_grade on chronicevents(grade);


DROP TABLE IF EXISTS precomputed;
drop index if exists p_sample;
drop index if exists p_termid;
drop index if exists p_value_for;
CREATE TABLE precomputed(
  sample integer,
  term_id TEXT,
  value_for TEXT,
  value TEXT,
  computable_grade integer,
  max_grade integer,
  most_recent integer
);

CREATE INDEX p_sample on precomputed(sample);
CREATE INDEX p_termid on precomputed(term_id);
CREATE INDEX p_value_for on precomputed(value_for);


---------------------------------------------
-- to build the subcohort_terms table
-- only required if cohort selection is enabled on the dataset
---------------------------------------------

DROP TABLE IF EXISTS subcohort_terms;
DROP INDEX IF EXISTS subcohort_terms_cohort;
DROP INDEX IF EXISTS subcohort_terms_termid;
CREATE TABLE subcohort_terms_2 (
 cohort TEXT,
 term_id TEXT,
 count INT,
 included_types TEXT
);

CREATE INDEX subcohort_terms_cohort ON subcohort_terms(cohort);
CREATE INDEX subcohort_terms_termid ON subcohort_terms(term_id);


DROP TABLE IF EXISTS survival;
DROP INDEX IF EXISTS survival_term;
DROP INDEX IF EXISTS survival_sample;
CREATE TABLE survival(
 sample INT,
 term_id TEXT,
 tte INT, -- time-to-event
 exit_code INT -- cohort defined exit code, may be 0=death, 1=censored, or similar
);
CREATE INDEX survival_term ON survival(term_id);
CREATE INDEX survival_sample ON survival(sample);
