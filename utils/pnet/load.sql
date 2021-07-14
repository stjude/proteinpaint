.mode tab

.import pnet_annotations.txt annotations
.import survival.txt survival

insert into terms
VALUES ('Survival outcome', 'Survival outcome', null, '{"type": "survival", "name": "Survival outcome"}', 0);

insert into terms
select term_id, term_id, 'Survival outcome', '{"type": "survival"}', 1
from survival
group by term_id;

insert into terms
select term_id, term_id, null, '{}', 1
from annotations
group by term_id;
