.mode tabs

.import pnet_annotations.txt annotations
.import survival.txt survival

insert into terms
VALUES ('Survival outcome', 'Survival outcome', null, '{"name": "Survival outcome"}', 0, '', 0);

insert into terms
-- will fill-in the jsondata using setterms.js
select term_id, term_id, 'Survival outcome', '{}', 1, 'survival', 1
from survival
group by term_id;

-- import available terms data 
.import terms.txt terms

insert into terms
select a.term_id, a.term_id, null, '{}', 1, '', 1
from annotations a
where a.term_id not in (select distinct(id) from terms)
group by term_id;

INSERT INTO terms
VALUES('Cytogenetics', 'Cytogenetics', NULL, '{"name": "Cytogenetics"}', 1, NULL, 0);

UPDATE terms
SET parent_id='Cytogenetics'
WHERE id IN (
'1p', '1q', '2p', '2q', '3p', '3q', '4p', '4q', '5p', '5q', '6p', '6q', '7p', '7q', '8p', '8q', '9p', '9q', '10p', '10q', '11p', '11q', '12p', '12q', '13q', '14q', '15q', '16p', '16q', '17p', '17q', '18p', '18q', '19p', '19q', '20p', '20q', '21q', '22q'
);
