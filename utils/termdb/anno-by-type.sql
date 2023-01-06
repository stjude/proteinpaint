PRAGMA foreign_keys=ON;

BEGIN TRANSACTION;

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
-- exclude combined cohorts that will cause sample double counting
-- assumes combined cohort names have a comma-separator
-- !!! TODO: need a guaranteed way to detect combined cohorts !!!
where t.type = 'integer' and cohort not like '%,%';




----------------------------------


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
-- exclude combined cohorts that will cause sample double counting
-- assumes combined cohort names have a comma-separator
-- !!! TODO: need a guaranteed way to detect combined cohorts !!!
where t.type = 'float' and cohort not like '%,%';

----------------------------------


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
-- exclude combined cohorts that will cause sample double counting
-- assumes combined cohort names have a comma-separator
-- !!! TODO: need a guaranteed way to detect combined cohorts !!!
where t.type = 'categorical' and cohort not like '%,%';

COMMIT;