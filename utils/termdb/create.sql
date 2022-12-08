drop index if exists sidmap_id;
drop table if exists sampleidmap;
create table sampleidmap (
  id integer primary key not null,
  name character varying(100) not null
);


drop index if exists terms_id;
drop index if exists terms_p;
drop index if exists terms_n;
drop table if exists terms;
create table terms (
  id character varying(100) not null primary key,
  name character varying(100) not null,
  parent_id character varying(100),
  jsondata json not null,
  child_order integer not null,
  type text,
  isleaf integer,
  foreign key(parent_id) references terms(id)

);

drop index if exists ancestry_tid;
drop index if exists ancestry_pid;
drop table if exists ancestry;
create table ancestry (
  term_id character varying(100) not null,
  ancestor_id character varying(100) not null,
  primary key(term_id, ancestor_id)
  foreign key(term_id) references terms(id),
  foreign key(ancestor_id) references terms(id)
);



-- may add term group and color etc
drop table if exists alltermsbyorder;
create table alltermsbyorder (
  group_name character not null,
  id character varying(100) primary key not null,
  foreign key(id) references terms(id)
);


DROP TABLE IF EXISTS termhtmldef;
DROP INDEX IF EXISTS termhtmldef_id;
CREATE TABLE termhtmldef (
  id character primary key not null,
  jsonhtml json not null,
  foreign key(id) references terms(id)

);


drop table if exists category2vcfsample;
create table category2vcfsample (
  subcohort character not null,
  group_name character not null,
  term_id character varying(100) not null,
  parent_name character varying(200) null,
  q text not null,
  categories text not null,
  primary key(subcohort, term_id, parent_name),
  foreign key(subcohort) references cohort(cohort),
  foreign key(term_id) references terms(id),
  foreign key(parent_name) references terms(id)
);


drop table if exists annotations;
drop index if exists a_sample;
drop index if exists a_termid;
drop index if exists a_value;
create table annotations (
  sample integer not null,
  term_id character varying(100) not null,
  value character varying(255) not null,
  primary key(sample, term_id),
  foreign key(sample) references sampleidmap(id),
  foreign key(term_id) references terms(id)
);

drop table if exists chronicevents;
drop index if exists c_sample;
drop index if exists c_termid;
drop index if exists c_grade;
create table chronicevents (
  sample integer not null,
  term_id character varying(100) not null,
  grade integer not null,
  age_graded real not null,
  years_to_event real not null,
  primary key(sample, term_id),
  foreign key(sample) references sampleidmap(id),
  foreign key(term_id) references terms(id)
);


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
  most_recent integer,
  primary key(sample, term_id),
  foreign key(sample) references sampleidmap(id),
  foreign key(term_id) references terms(id)
);



---------------------------------------------
-- to build the subcohort_terms table
-- only required if cohort selection is enabled on the dataset
---------------------------------------------

DROP TABLE IF EXISTS subcohort_terms;
DROP INDEX IF EXISTS subcohort_terms_cohort;
DROP INDEX IF EXISTS subcohort_terms_termid;
CREATE TABLE subcohort_terms (
 cohort TEXT,
 term_id TEXT,
 count INT,
 included_types TEXT,
 child_types TEXT,
  --primary key(cohort, term_id),
  foreign key(term_id) references terms(id)
);



DROP TABLE IF EXISTS survival;
DROP INDEX IF EXISTS survival_term;
DROP INDEX IF EXISTS survival_sample;
CREATE TABLE survival(
 sample INT,
 term_id TEXT,
 tte INT, -- time-to-event
 exit_code INT, -- cohort defined exit code, may be 0=death, 1=censored, or similar
primary key(sample, term_id),
foreign key(sample) references sampleidmap(id),
foreign key(term_id) references terms(id)
);




