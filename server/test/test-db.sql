/* 
!!! WARNING !!!
Running this file may require changes to the
expected test results in termdb-related tests. 

example use as 

$ sqlite3 dbfilename
sqlite> .read /path/to/proteinpaint/server/test/test-db.sql
- OR -
$ sqlite3 dbfilename < /path/to/proteinpaint/server/test/test-db.sql
- OR -
# from the sjlife directory above the clinical/ subdir
$ ./path/to/proteinpaint/server/test/set-test-db.sh
*/

DROP VIEW IF EXISTS samples;

CREATE VIEW samples
AS 
select *
from
(
select distinct(sample) as sample
from annotations
-- samples seem to be ordered by diaggrp, using
-- modulo skips samples to have a more 'balanced' diaggrp bar chart
where sample % 14 = 0 AND term_id = 'subcohort' AND value='SJLIFE' 
limit 60
)
UNION ALL
select *
from (
select distinct(sample)
from annotations
where term_id = 'subcohort' AND value='CCSS' 
limit 40
);

CREATE VIEW annoterms
AS
select id
from terms
where id in (
'subcohort',
'diaggrp',
'aaclassic_5',
'cisplateq_5',
'sex',
'agedx',
'Cardiac dysrhythmia',
'Asthma',
'Hearing loss',
'wgs_curated',
'genetic_race'
);

CREATE VIEW treeterms
AS
select id
from terms
where id in (
'Cancer-related Variables',
'Diagnosis',
'Treatment',
'Chemotherapy, Lifetime',
'Alkylating Agents, mg/m2',
'Platinum Agents, mg/m2',
'Demographic Variables',
'Age (years)',
'Clinically-assessed Variables',
'ctcae_graded',
'Cardiovascular System',
'Arrhythmias',
'yeardx', 
'Echocardiogram',
'Cardiomyopathy',
'Cardiovascular dysfunction',
'Respiratory System',
'Chronic respiratory disorder',
'Auditory System',
'Genomic Profiling Status'
);

delete
from annotations
where 
sample not in (select sample from samples) 
OR term_id NOT IN (select id from annoterms);

-- to satisfy tests with unknown exposure
update annotations 
set value=-8888 
where sample=2660 and term_id='aaclassic_5';

-- to randomize age at diagnosis
update annotations
set value = value + abs(random() % 3) - abs(random() % 3)
where term_id = 'agedx';

-- to shuffle sex values
update annotations 
set value=2 
where term_id='sex' and value=1 and abs(random() % 3) = 0 
limit 15;

update annotations 
set value=1 
where term_id='sex' and value=2 and abs(random() % 3) = 0 
limit 15;

delete
from precomputed
where 
sample not in (select sample from samples) 
OR 
(
term_id NOT IN (select id from annoterms)
AND
term_id NOT IN (select id from treeterms)
);

delete 
from chronicevents
where 
sample not in (select sample from samples)  
OR term_id NOT IN (select id from annoterms);

-- to randomize time points
update chronicevents
set age_graded = age_graded + abs(random() % 3) - abs(random() % 3),
	years_to_event = years_to_event + abs(random() % 3) - abs(random() % 3);

delete
from category2vcfsample
where term_id NOT IN (select id from annoterms);

delete
from sampleidmap
where id not in (select sample from samples);

update sampleidmap set name=rowid;

delete
from terms
where id NOT IN (select id from annoterms) 
AND id NOT IN (select id from treeterms);

delete
from ancestry
where 
(
term_id NOT IN (select id from annoterms) 
AND term_id NOT IN (select id from treeterms)
)
OR
(
ancestor_id NOT IN (select id from annoterms) 
AND ancestor_id NOT IN (select id from treeterms)
);

delete
from alltermsbyorder
where 
(
group_name NOT IN (select id from annoterms) 
AND 
group_name NOT IN (select id from treeterms)
)
OR 
(
id NOT IN (select id from annoterms)
AND 
id NOT IN (select id from treeterms)
);

delete
from subcohort_terms
where term_id NOT IN (select id from annoterms) 
AND term_id NOT IN (select id from treeterms)
AND term_id != '$ROOT$';

# from the proteinpaint/server dir, run 
# $ node server.js phewas-precompute hg38 TermdbTest
# then from your/tp/files/hg38/sjlife/clinical dir, 
# $ sqlite3 db2 
.mode tab
drop table if exists category2vcfsample;
create table category2vcfsample (
subcohort character not null,
group_name character not null,
term_id character varying(100) not null,
parent_name character varying(200) null,
q text not null,
categories text not null
);
.import 'category2vcfsample-test' category2vcfsample

# CEU annotations are required for viewing the TermdbTest dataset
# as http://localhost:3000/example.mds2.html#TermdbTest
insert into annotations (sample, term_id, value)
select sample, 'CEU', random()/(2*9223372036854775808) + 0.5
from samples;

vacuum;
reindex;
