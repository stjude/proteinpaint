drop table if exists anno_integer;
drop index if exists a_int_sample;
drop index if exists a_int_termid;
drop index if exists a_int_value;
create table anno_integer (
  sample integer not null,
  term_id character varying(100) not null,
  value integer not null
);
create index a_int_sample on anno_integer(sample);
create index a_int_termid on anno_integer(term_id);
create index a_int_value on anno_integer(value);

-- copy entries from the annotations table
insert into anno_integer (sample, term_id, value) 
select sample, term_id, CAST(value as integer) 
from annotations a 
join terms t on t.id=a.term_id and t.type='integer';

-- compare the unique sample and term counts to verify
select '----   #annotated samples, #terms   ------';
select 'anno_integer', count(*), count(distinct(term_id))
from anno_integer;
select 'subcohort_term integer', sum(s.count), count(distinct(term_id)) 
from subcohort_terms s 
join terms t on t.id = s.term_id 
where t.type = 'integer' and cohort != 'CCSS,SJLIFE' ;




----------------------------------

drop table if exists anno_float;
drop index if exists a_float_sample;
drop index if exists a_float_termid;
drop index if exists a_float_value;
create table anno_float (
  sample integer not null,
  term_id character varying(100) not null,
  value REAL not null
);
create index a_float_sample on anno_integer(sample);
create index a_float_termid on anno_integer(term_id);
create index a_float_value on anno_integer(value);

-- copy entries from the annotations table
insert into anno_float (sample, term_id, value) 
select sample, term_id, CAST(value as real) 
from annotations a 
join terms t on t.id=a.term_id and t.type='float';

-- compare the unique sample and term counts to verify
select '----   #annotated samples, #terms   ------';
select 'anno_float', count(*), count(distinct(term_id))
from anno_float;
select 'subcohort_term float', sum(s.count), count(distinct(term_id))
from subcohort_terms s 
join terms t on t.id = s.term_id 
where t.type = 'float' and cohort != 'CCSS,SJLIFE' ;

----------------------------------

drop table if exists anno_categorical;
drop index if exists a_cat_sample;
drop index if exists a_cat_termid;
drop index if exists a_cat_value;
create table anno_categorical (
  sample integer not null,
  term_id character varying(100) not null,
  value REAL not null
);
create index a_cat_sample on anno_categorical(sample);
create index a_cat_termid on anno_categorical(term_id);
create index a_cat_value on anno_categorical(value);

-- copy entries from the annotations table
insert into anno_categorical (sample, term_id, value) 
select sample, term_id, value 
from annotations a 
join terms t on t.id=a.term_id and t.type='categorical';

-- compare the unique sample and term counts to verify
select '----   #annotated samples, #terms   ------';
select 'anno_categorical', count(*), count(distinct(term_id))
from anno_categorical;
select 'subcohort_term categorical', sum(s.count), count(distinct(term_id)) 
from subcohort_terms s 
join terms t on t.id = s.term_id 
where t.type = 'categorical' and cohort != 'CCSS,SJLIFE' ;

