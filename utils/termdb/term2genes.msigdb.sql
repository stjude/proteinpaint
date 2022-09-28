drop table if exists term2genes;
create table term2genes (
  id character varying(100) not null,
  genes text not null
);
