drop table if exists term2genes;
create table term2genes (
  id character varying(100) primary key not null,
  genes text not null,
  foreign key (id) references terms(id) on delete cascade
);
