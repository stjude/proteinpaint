.mode tab


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

.import termdb terms

-- only do this if cohort selection is enabled
-- using * for parent id of subcohort makes it hidden from the tree (but still searchable by name)
INSERT INTO terms VALUES ('subcohort', 'Cohort', '*', '{"name":"Cohort","type":"categorical","values":{"SJLIFE":{"label":"SJLIFE"},"CCSS":{"label":"CCSS"}}}', 0);

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
  group_name character not null,
  term_id character varying(100) not null,
  parent_name character varying(200) null,
  q text not null,
  categories text not null
);
.import category2vcfsample.nograde9 category2vcfsample




drop table if exists annotations;
drop index if exists a_sample;
drop index if exists a_termid;
drop index if exists a_value;
create table annotations (
  sample character varying(50) not null,
  term_id character varying(100) not null,
  value character varying(255) not null
);

.import annotation.matrix annotations
.import annotation.admix annotations

create index a_sample on annotations(sample);
create index a_termid on annotations(term_id);
create index a_value on annotations(value);



drop table if exists chronicevents;
drop index if exists c_sample;
drop index if exists c_termid;
drop index if exists c_grade;
create table chronicevents (
  sample character varying(50) not null,
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
CREATE TABLE precomputed(
  sample TEXT,
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

-- imported filename must match the 
-- dataset/sjlife2.hg38.js:cohort.termdb.precomputed_file value
.import chronicevents.precomputed precomputed
