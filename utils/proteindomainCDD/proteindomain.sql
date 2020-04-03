drop table if exists domain;
CREATE TABLE domain (
	isoform varchar(30) not null,
	data json not null
);
.mode tabs
.import proteindomain.json domain

CREATE INDEX domain_isoform on domain(isoform collate nocase);

