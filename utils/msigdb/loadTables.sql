drop table if exists term2genes;
create table term2genes (
  id character varying(100) not null,
  genes text not null
);

.mode tabs

.import term2genes term2genes
create index term2genes_id on term2genes(id);

-- this is a quick fix!
-- under "C2: curated gene sets" > "CP: Canonical pathways"
-- the non-leaf term "WikiPathways subset of CP" will not be shown following these four siblings (BIOCARTA/KEGG/PID/REACTOME)
-- this fix will allow WikiPathways to show at the 5th position, allowing for a neater look under "CP" branch
-- the "CP" branch is the only one with children of both leaf and non-leaf terms, so this fix may be fine
update terms set child_order=4.1 where id='WikiPathways subset of CP';
