.mode tab

.import pnet_annotations.txt annotations
.import survival.txt survival

insert into terms
VALUES ('Survival outcome', 'Survival outcome', null, '{"name": "Survival outcome"}', 0);

insert into terms
-- will fill-in the jsondata using setterms.js
select term_id, term_id, 'Survival outcome', '{}', 1
from survival
group by term_id;

insert into terms
select term_id, term_id, null, '{}', 1
from annotations
group by term_id;

insert into ancestry (term_id, ancestor_id)
values 
('efs', 'Survival outcome'), 
('os', 'Survival outcome');

