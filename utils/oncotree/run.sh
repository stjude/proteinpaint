
# converts sj disease code to oncotree code, and produce updated sample table
# for sj codes with no match to oncotree, the sj codes are still used in sample table
# and these sj codes will be added to the <NA> branch to the oncotree sj subset
node ~/proteinpaint/utils/oncotree/convertsj2oncotree.js sj2oncotree raw/sampletable
# made two files: table.oncoid and oncotree.sjmissing

# subset the entire oncotree to produce the "sj subset"
node ~/proteinpaint/utils/oncotree/subset.oncotree.js raw/oncotree.allterms table.oncoid  > oncotree.sjsubset
# append <NA> branch to sjsubset
cat oncotree.sjmissing >> oncotree.sjsubset

# convert sample table to load file for "annotations" table
# in sample table, samples are only annotated to leaf codes, during output, annotation to all parent codes will be added
node ~/proteinpaint/utils/oncotree/table2annotation.js oncotree.sjsubset table.oncoid > termdb/annotation.diseasecode

node ~/proteinpaint/utils/oncotree/oncotree2term.js oncotree.sjsubset
# made two files: termdb/terms and termdb/ancestry

sqlite3 db < load.sql
