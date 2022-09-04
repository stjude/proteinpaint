drop table if exists term2genes;
create table term2genes (
  id character varying(100) not null,
  genes text not null
);

.mode tabs

.import term2genes term2genes
create index term2genes_id on term2genes(id);
