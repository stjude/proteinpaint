.mode tab

drop index if exists sidmap_id;
drop table if exists sampleidmap;
create table sampleidmap (
  id integer not null,
  name character varying(100) not null
);
.import 'samples.idmap' sampleidmap
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
  child_order integer not null,
  type text,
  isleaf integer
);

.import termdb terms

-- only do this if cohort selection is enabled
-- using * for parent id of subcohort makes it hidden from the tree (but still searchable by name)
INSERT INTO terms VALUES ('subcohort', 'Cohort', '*', '{"name":"Cohort","type":"categorical","values":{"SJLIFE":{"label":"SJLIFE"},"CCSS":{"label":"CCSS"}}}', 0, NULL, 0);

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

.import ancestry ancestry
create index ancestry_tid on ancestry(term_id);
create index ancestry_pid on ancestry(ancestor_id);



-- may add term group and color etc
drop table if exists alltermsbyorder;
create table alltermsbyorder (
  group_name character not null,
  id character varying(100) not null
);
.import 'alltermsbyorder.grouped' alltermsbyorder




DROP TABLE IF EXISTS termhtmldef;
DROP INDEX IF EXISTS termhtmldef_id;
CREATE TABLE termhtmldef (
  id character not null,
  jsonhtml json not null
);
CREATE INDEX termhtmldef_id on termhtmldef(id);
.import termid2htmldef termhtmldef



drop table if exists category2vcfsample;
create table category2vcfsample (
  subcohort character not null,
  group_name character not null,
  term_id character varying(100) not null,
  parent_name character varying(200) null,
  q text not null,
  categories text not null
);
.import category2vcfsample category2vcfsample




drop table if exists annotations;
drop index if exists a_sample;
drop index if exists a_termid;
drop index if exists a_value;
create table annotations (
  sample integer not null,
  term_id character varying(100) not null,
  value character varying(255) not null
);

.import annotation.matrix annotations
.import annotation.admix.sjlife annotations
.import annotation.admix.ccss annotations

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

.import annotation.outcome chronicevents

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

.import chronicevents.precomputed precomputed
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
CREATE TABLE subcohort_terms (
 cohort TEXT,
 term_id TEXT,
 count INT
 -- this column will be added later in a separate script, 
 -- so that the precompute script output can still line up
 -- included_types TEXT
);
.import term2subcohort subcohort_terms

CREATE INDEX subcohort_terms_cohort ON subcohort_terms(cohort);
CREATE INDEX subcohort_terms_termid ON subcohort_terms(term_id);
