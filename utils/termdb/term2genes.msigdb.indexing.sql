

create index term2genes_id on term2genes(id);

-------------------------------------------
-- msigdb-specific quick fix!
-------------------------------------------

-- following are due to line ordering issues in file "msigdb_v2022.1.Hs.xml"
-- if these issues are gone in later versions, change code accordingly

-- under "C2: curated gene sets" > "CP: Canonical pathways"
-- two non-leaf terms "WikiPathways subset of CP" and "REACTOME subset of CP" will appear out of order and not grouped to the top with other non-leaf terms
-- the "CP" branch is the only one with children of both leaf and non-leaf terms, so this fix may be fine
update terms set child_order=3.1 where id like 'WikiPathways subset of CP%';
update terms set child_order=3.2 where id like 'REACTOME subset of CP%';


-- put the 'H: hallmark gene sets' to the first of all root terms
update terms set child_order=0.1 where id like 'H: hallmark gene sets%';

-- first line of xml is a set from C2, must reset order of C2
update terms set child_order=2.1 where id like 'C2: curated gene sets%';

-- C5 also appears out of place
update terms set child_order=4.1 where id like 'C5: ontology gene sets%';
