CREATE TABLE genes (
  name character varying(50) collate nocase primary key not null,
  isoform character varying(50) collate nocase,
  isdefault smallint,
  genemodel json
);
CREATE INDEX geneisoform on genes(isoform collate nocase);


CREATE TABLE genealias (
  alias character varying(50) collate nocase,
  name character varying(50) collate nocase,
  foreign key(name) references genes(name) on delete cascade on update cascade
);
CREATE INDEX aliastext on genealias(alias collate nocase);


CREATE TABLE gene2canonicalisoform (
	gene character collate nocase primary key not null,
	isoform character collate nocase,
    foreign key(gene) references genes(name) on delete cascade on update cascade

);

CREATE TABLE gene2coord (
  name char(100) collate nocase primary key not null,
  chr char(100) collate nocase,
  start INTEGER,
  stop INTEGER,
  foreign key(name) references genes(name) on delete cascade on update cascade

);

CREATE TABLE refseq2ensembl (
  ensembl char(100) collate nocase,
  refseq char(100) collate nocase
);
CREATE INDEX r2er on refseq2ensembl(refseq);
CREATE INDEX r2ee on refseq2ensembl(ensembl);

CREATE TABLE isoform2gene (
	gene character collate nocase,
	isoform character collate nocase,
    foreign key(gene) references genes(name) on delete cascade on update cascade

);
CREATE INDEX isoform2gene_isoform on isoform2gene(isoform);







