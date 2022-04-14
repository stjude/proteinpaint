insert into ancestry
select distinct(term_id), 'Survival outcome'
from survival;
