delete from ancestry;

insert into ancestry (term_id, ancestor_id)
with recursive a(id, ancestor_id) as (
	select id, parent_id
	from terms
	where parent_id is not null and parent_id != '*' -- and id='Cardiac dysrhythmia' -- for testing
	union all
	select a.id, t.parent_id
	from terms t
	join a on a.ancestor_id = t.id
	where t.parent_id is not null and parent_id != '*'
)
select * 
from a;
