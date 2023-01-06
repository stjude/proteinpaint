
drop table if exists cohorts;
create table cohorts (
  cohort character primary key not null,
  name character not null,
  abbrev character not null,
  sample_count integer not null
);



drop table if exists samples;
create table samples (
  id integer primary key not null,
  cname character varying(100) default null
);


drop table if exists sampleidmap;
create table sampleidmap (
  id integer not null,
  name character varying(100) not null,
  primary key(id, name),
  foreign key(id) references samples(id) on delete cascade
);


drop table if exists terms;
create table terms (
  id character varying(100) not null primary key,
  name character varying(100) not null,
  parent_id character varying(100),
  jsondata json not null,
  child_order integer not null,
  type text,
  isleaf integer
  --When importing data parent_id it is imported as an empty string and breaks the foreign key checkup
  --foreign key(parent_id) references terms(id) on delete cascade
);


drop table if exists ancestry;
create table ancestry (
  term_id character varying(100) not null,
  ancestor_id character varying(100) not null,
  primary key(term_id, ancestor_id)
  foreign key(term_id) references terms(id)  on delete cascade
  --foreign key(ancestor_id) references terms(id) on delete cascade
);


-- may add term group and color etc
drop table if exists alltermsbyorder;
create table alltermsbyorder (
  group_name character not null,
  id character varying(100) not null,
  --primary key(group_name, id),
  foreign key(id) references terms(id) on delete cascade
);


DROP TABLE IF EXISTS termhtmldef;
CREATE TABLE termhtmldef (
  id character primary key not null,
  jsonhtml json not null,
  foreign key(id) references terms(id) on delete cascade

);


drop table if exists category2vcfsample;
create table category2vcfsample (
  subcohort character not null,
  group_name character not null,
  term_id character varying(100) not null,
  parent_name character varying(200) null,
  q text not null,
  categories text not null,
  foreign key(subcohort) references cohorts(cohort) on delete cascade,
  foreign key(group_name, term_id) references alltermsbyorder(group_name, id) on delete cascade
  foreign key(parent_name) references terms(id) on delete cascade
);


drop table if exists annotations;
create table annotations (
  sample integer not null,
  term_id character varying(100) not null,
  value character varying(255) not null,
  primary key(term_id, sample),
  foreign key(sample) references samples(id) on delete cascade
  foreign key(term_id) references terms(id) on delete cascade
);


drop table if exists chronicevents;
create table chronicevents (
  sample integer not null,
  term_id character varying(100) not null,
  grade integer not null,
  age_graded real not null,
  years_to_event real not null,
  foreign key(sample) references samples(id) on delete cascade,
  foreign key(term_id) references terms(id) on delete cascade
);


DROP TABLE IF EXISTS precomputed;
CREATE TABLE precomputed(
  sample integer not null,
  term_id TEXT not null,
  value_for TEXT,
  value TEXT,
  computable_grade integer,
  max_grade integer,
  most_recent integer,
  primary key(term_id, sample, value_for, value),
  foreign key(sample) references samples(id) on delete cascade,
  foreign key(term_id) references terms(id) on delete cascade
);


---------------------------------------------
-- to build the subcohort_terms table
-- only required if cohort selection is enabled on the dataset
---------------------------------------------

DROP TABLE IF EXISTS subcohort_terms;
CREATE TABLE subcohort_terms (
 cohort TEXT not null,
 term_id TEXT not null,
 count INT,
 included_types TEXT,
 child_types TEXT,
primary key(cohort, term_id),
foreign key(cohort) references cohorts(cohort) on delete cascade,
foreign key(term_id) references terms(id) on delete cascade
);


DROP TABLE IF EXISTS subcohort_samples;
CREATE TABLE subcohort_samples (
subcohort TEXT not null,
sample integer not null,
primary key(subcohort, sample),
foreign key(sample) references samples(id) on delete cascade,
foreign key(subcohort) references cohorts(cohort) on delete cascade
);


DROP TABLE IF EXISTS survival;
CREATE TABLE survival(
 sample integer not null,
 term_id TEXT not null,
 tte INT, -- time-to-event
 exit_code INT, -- cohort defined exit code, may be 0=death, 1=censored, or similar
primary key(term_id, sample),
foreign key(sample) references samples(id) on delete cascade,
foreign key(term_id) references terms(id) on delete cascade
);



DROP TABLE IF EXISTS features;
CREATE TABLE features(
  idfeature integer primary key autoincrement,
  name character not null
);

DROP TABLE IF EXISTS cohort_features;
CREATE TABLE cohort_features(
cohort character not null,
idfeature integer not null,
value character not null,
primary key(cohort, idfeature),
foreign key(cohort) references cohorts(cohort) on delete cascade
foreign key(idfeature) references features(idfeature) on delete cascade

);



drop table if exists anno_integer;
create table anno_integer (
  sample integer not null,
  term_id character varying(100) not null,
  value integer not null,
  primary key(term_id, sample),
  foreign key(term_id) references terms(id) on delete cascade,
  foreign key(sample) references samples(id) on delete cascade

);


drop table if exists anno_float;
create table anno_float (
  sample integer not null,
  term_id character varying(100) not null,
  value REAL not null,
  primary key(term_id, sample),
  foreign key(term_id) references terms(id),
  foreign key(sample) references samples(id)

);

drop table if exists anno_categorical;
create table anno_categorical (
  sample integer not null,
  term_id character varying(100) not null,
  value character varying(255) not null,
  primary key(term_id, sample),
  foreign key(term_id) references terms(id),
  foreign key(sample) references samples(id)
);


-- TODO how to load up a field as "null" from flatfile so no need to run this line

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

create index anno_int_sample on anno_integer(sample);
create index anno_int_value on anno_integer(value);

create index anno_float_sample on anno_float(sample);
create index anno_float_value on anno_float(value);


create index anno_cat_sample on anno_categorical(sample);
create index anno_cat_value on anno_categorical(value);
