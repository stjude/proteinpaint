# hpc location:
# hpc:~/tp/files/hg38/sjlife/clinical/

# deploy scripts from dev computer to hpc:
# % scp * hpc:~/tp/files/hg38/sjlife/clinical/scripts/

# one time setup on hpc:
# $ npm install partjson

# build db on hpc:
# $ bsub -P pcgp -M 10000 'sh scripts/do.sh'



set -e
set -u
set -o pipefail

###############################################
# this is a temporary step!
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
# appended to "annotation.matrix"

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

node ./scripts/validate.ctcae.js phenotree/sjlifectcae.tree raw/intID/outcomes_sjlife.txt > annotation.outcome
node ./scripts/validate.ctcae.js phenotree/ccssctcae.tree raw/intID/outcomes_ccss.txt >> annotation.outcome
node ./scripts/validate.ctcae.js phenotree/sn.tree raw/intID/subneoplasms.txt >> annotation.outcome
# created "annotation.outcome"
node ./scripts/precompute.ctcae.js termdb annotation.outcome > chronicevents.precomputed
# created "chronicevents.precomputed"
node ./scripts/precompute.ctcae.addNotTested.js >> chronicevents.precomputed
# grade=-1 rows appended to indicate "not tested" cases

node ./scripts/term2subcohort.js termdb annotation.matrix annotation.outcome > term2subcohort
# created "term2subcohort"


#node ./scripts/phewas.precompute.url.js
#node ./scripts/category2sample.removegrade9.js category2vcfsample termdb annotation.outcome > category2vcfsample.nograde9

sqlite3 db < ./scripts/load.sql
sqlite3 db < ./scripts/set-included-types.sql
sqlite3 db < ./scripts/anno-by-type.sql

# scp db $ppr:/opt/data/pp/tp_native_dir/files/hg38/sjlife/clinical/
# scp db $prp1:~/data-pp/files/hg38/sjlife/clinical/
