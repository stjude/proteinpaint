# hpc location:
# hpc:~/tp/files/hg38/sjlife/clinical/

# deploy scripts from dev computer to hpc:
# % scp * ../termdb/create.sql ../termdb/anno-by-type.sql ../termdb/set-included-types.sql ../../server/shared/termdb.initbinconfig.js hpc:~/tp/files/hg38/sjlife/clinical/scripts/

# one time setup on hpc:
# $ npm install partjson

# build db on hpc:
# $ bsub -P pcgp -M 10000 'sh scripts/do.sh'



set -e
set -u
set -o pipefail

echo 'Generating import files ...'
###############################################
# temporary step
# copy "matrix.tree.original" to "matrix.tree" and append new line to describe the adhoc "publication" term annotated to samples from CH paper
# subsequent steps all use "matrix.tree"
cp phenotree/matrix.tree.original phenotree/matrix.tree
printf '\nPublication sample filter\tSJLIFE clonal hematopoiesis study, Hagiwara et. al. under review\t-\t-\t-\tpublication_CH\tstring; 1=Yes\n' >> phenotree/matrix.tree


###############################################
# temporary step
# updates file "phenotree/matrix.tree" in place
node ./scripts/phenotree.tempfix.chemo.js


###############################################
# procedures to build database table files

node ./scripts/update2matrix.js raw/matrix.raw > matrix.stringID
# created "matrix.stringID"
node ./scripts/matrix.string2intID.js > matrix
# created "samples.idmap"
# created "matrix", now using integer sample id

node ./scripts/matrix2db.js matrix > annotation.matrix
# created "annotation.matrix"
node ./scripts/replace.sampleid.js PRS/annotation.scores 0 >> annotation.matrix
node ./scripts/replace.sampleid.js annotation.publication.stringId 0 >> annotation.matrix
# appended two extra files to "annotation.matrix"

node ./scripts/replace.sampleid.js raw/outcomes_sjlife.txt 0 yes > raw/intID/outcomes_sjlife.txt
node ./scripts/replace.sampleid.js raw/outcomes_ccss.txt 0 yes > raw/intID/outcomes_ccss.txt
node ./scripts/replace.sampleid.js raw/subneoplasms.txt 0,1 yes > raw/intID/subneoplasms.txt
# created 3 files under raw/intID/

node ./scripts/replace.sampleid.js raw/annotation.stringid.admix 0 > annotation.admix

node ./scripts/remove.doublequote.js phenotree/matrix.tree
node ./scripts/remove.doublequote.js phenotree/ccssctcae.tree
node ./scripts/remove.doublequote.js phenotree/sjlifectcae.tree
node ./scripts/remove.doublequote.js phenotree/sn.tree
# updated files in-place

node ./scripts/phenotree.parse.atomic.js phenotree/matrix.tree matrix
# created "keep/termjson"
# created "diagnostic_messages.txt"

sh ./scripts/phenotree.makeentiretree.sh
# created "phenotree/entire.tree"


node ./scripts/phenotree.2phewastermlist.js phenotree/entire.tree > alltermsbyorder.grouped
# created "alltermsbyorder.grouped"

node ./scripts/phenotree.parse.term2term.js phenotree/entire.tree keep/termjson
# created "ancestry"
# created "termdb"

cat PRS/ancestry.prs >> ancestry
node ./scripts/subcohort.validateancestry.js ancestry

node ./scripts/parse.ctcaegradedef.js
# created "termdb.updated"
# created "termid2htmldef"
mv termdb.updated termdb

node ./scripts/checkPrsDuplicateTerms.js
# halts upon any duplicating terms; send to Jian to handle in PRS data prep step

cat PRS/termdb.prs >> termdb
cat PRS/termid2htmldef.prs >> termid2htmldef
cat termid2htmldef.pub >> termid2htmldef

node ./scripts/validate.ctcae.js phenotree/sjlifectcae.tree raw/intID/outcomes_sjlife.txt > annotation.outcome
node ./scripts/validate.ctcae.js phenotree/ccssctcae.tree raw/intID/outcomes_ccss.txt >> annotation.outcome
node ./scripts/validate.ctcae.js phenotree/sn.tree raw/intID/subneoplasms.txt >> annotation.outcome
# created "annotation.outcome"

node ./scripts/filter.annotation.outcome.js termdb annotation.outcome
# updated annotation.outcome by removing lines with unknown terms

node ./scripts/precompute.ctcae.js termdb annotation.outcome > chronicevents.precomputed
# created "chronicevents.precomputed"
node ./scripts/precompute.ctcae.addNotTested.js >> chronicevents.precomputed
# grade=-1 rows appended to indicate "not tested" cases

node ./scripts/findUnknownTerms.js annotation.matrix termdb
# detect and report unknown terms

node --max-old-space-size=10240 ./scripts/term2subcohort.js termdb annotation.matrix annotation.outcome > term2subcohort
# created "term2subcohort"


#node ./scripts/phewas.precompute.url.js
#node ./scripts/category2sample.removegrade9.js category2vcfsample termdb annotation.outcome > category2vcfsample.nograde9
echo 'Creating db schema...'
sqlite3 db < ./scripts/create.sql
sqlite3 db < ./scripts/init-cohorts.sql
echo 'Loading data...'
sqlite3 db < ./scripts/load.sql
sqlite3 db < ./scripts/set-included-types.sql
echo 'Adding annotation by type tables'
sqlite3 db < ./scripts/anno-by-type.sql
sqlite3 db < ./scripts/indexing.sql


# scp db $ppr:/opt/data/pp/tp_native_dir/files/hg38/sjlife/clinical/
# scp db $prp1:~/data-pp/files/hg38/sjlife/clinical/
