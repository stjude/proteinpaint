insert into ancestry (term_id, ancestor_id)
select id, parent_id
from terms
where parent_id is not null;
