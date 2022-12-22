.mode tab

.import 'samples.idmap' sampleidmap

--PRAGMA foreign_keys=ON;

insert into samples(id) select distinct(id) from sampleidmap;

.import termdb terms

-- only do this if cohort selection is enabled
-- using * for parent id of subcohort makes it hidden from the tree (but still searchable by name)
INSERT INTO terms VALUES ('subcohort', 'Cohort', '*', '{"name":"Cohort","type":"categorical","values":{"SJLIFE":{"label":"SJLIFE"},"CCSS":{"label":"CCSS"}}}', 0, NULL, 0);

INSERT INTO terms VALUES ('ASA', 'ASA', '*', '{"name":"ASA","type":"float"}', 0, "float", 0);
INSERT INTO terms VALUES ('CEU', 'CEU', '*', '{"name":"CEU","type":"float"}', 0, "float", 0);
INSERT INTO terms VALUES ('YRI', 'YRI', '*', '{"name":"YRI","type":"float"}', 0, "float", 0);

.import ancestry ancestry

.import 'alltermsbyorder.grouped' alltermsbyorder

.import termid2htmldef termhtmldef

.import category2vcfsample category2vcfsample

.import annotation.matrix annotations

.import annotation.admix annotations

insert into subcohort_samples(subcohort, sample) select value, sample from annotations where term_id='subcohort';

.import annotation.outcome chronicevents

.import chronicevents.precomputed precomputed

.import term2subcohort subcohort_terms


