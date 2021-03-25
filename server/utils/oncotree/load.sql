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

.import termdb/terms terms

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

.import termdb/ancestry ancestry
create index ancestry_tid on ancestry(term_id);
create index ancestry_pid on ancestry(ancestor_id);


drop table if exists annotations;
drop index if exists a_sample;
drop index if exists a_termid;
drop index if exists a_value;
create table annotations (
  sample character varying(50) not null,
  term_id character varying(100) not null,
  value character varying(255) not null
);

.import termdb/annotation.diseasecode annotations

create index a_sample on annotations(sample);
create index a_termid on annotations(term_id);
create index a_value on annotations(value);
