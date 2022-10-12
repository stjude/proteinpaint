###############################################
# working dir: ~/data/tp/files/hg38/sjlife/clinical/
#
# % ln -s ~/dev/proteinpaint/utils/sjlife2/do.sh .
# % ln -s ~/dev/proteinpaint/utils/termdb/anno-by-type.sql .
# % ln -s ~/dev/proteinpaint/utils/termdb/set-included-types.sql .
# % sh do.sh


set -e
set -u
set -o pipefail

###############################################
# this is a temporary step!
# updates file "phenotree/matrix.tree" in place
node ~/dev/proteinpaint/utils/sjlife2/phenotree.tempfix.chemo.js

###############################################
# procedures to build database table files

node ~/dev/proteinpaint/utils/sjlife2/update2matrix.js raw/matrix.raw > matrix.stringID
# created "matrix.stringID"
node ~/dev/proteinpaint/utils/sjlife2/matrix.string2intID.js > matrix
# created "samples.idmap"
# created "matrix", now using integer sample id

node ~/dev/proteinpaint/utils/sjlife2/matrix2db.js matrix > annotation.matrix
# created "annotation.matrix"
node ~/dev/proteinpaint/utils/sjlife2/replace.sampleid.js PRS/annotation.scores 0 >> annotation.matrix
# appended to "annotation.matrix"

node ~/dev/proteinpaint/utils/sjlife2/replace.sampleid.js raw/outcomes_sjlife.txt 0 yes > raw/intID/outcomes_sjlife.txt
node ~/dev/proteinpaint/utils/sjlife2/replace.sampleid.js raw/outcomes_ccss.txt 0 yes > raw/intID/outcomes_ccss.txt
node ~/dev/proteinpaint/utils/sjlife2/replace.sampleid.js raw/subneoplasms.txt 0,1 yes > raw/intID/subneoplasms.txt
# created 3 files under raw/intID/

node ~/dev/proteinpaint/utils/sjlife2/replace.sampleid.js raw/annotation.stringid.admix 0 > annotation.admix

node ~/dev/proteinpaint/utils/sjlife2/remove.doublequote.js phenotree/matrix.tree
node ~/dev/proteinpaint/utils/sjlife2/remove.doublequote.js phenotree/ccssctcae.tree
node ~/dev/proteinpaint/utils/sjlife2/remove.doublequote.js phenotree/sjlifectcae.tree
node ~/dev/proteinpaint/utils/sjlife2/remove.doublequote.js phenotree/sn.tree
# updated files in-place

node ~/dev/proteinpaint/utils/sjlife2/phenotree.parse.atomic.js phenotree/matrix.tree matrix
# created "keep/termjson"
# created "diagnostic_messages.txt"

sh ~/dev/proteinpaint/utils/sjlife2/phenotree.makeentiretree.sh
# created "phenotree/entire.tree"

node ~/dev/proteinpaint/utils/sjlife2/phenotree.2phewastermlist.js phenotree/entire.tree > alltermsbyorder.grouped
# created "alltermsbyorder.grouped"

node ~/dev/proteinpaint/utils/sjlife2/phenotree.parse.term2term.js phenotree/entire.tree keep/termjson
# created "ancestry"
# created "termdb"

cat PRS/ancestry.prs >> ancestry
node ~/dev/proteinpaint/utils/sjlife2/subcohort.validateancestry.js ancestry

node ~/dev/proteinpaint/utils/sjlife2/parse.ctcaegradedef.js
# created "termdb.updated"
# created "termid2htmldef"
mv termdb.updated termdb
cat PRS/termdb.prs >> termdb
cat PRS/termid2htmldef.prs >> termid2htmldef

node ~/dev/proteinpaint/utils/sjlife2/validate.ctcae.js phenotree/sjlifectcae.tree raw/intID/outcomes_sjlife.txt > annotation.outcome
node ~/dev/proteinpaint/utils/sjlife2/validate.ctcae.js phenotree/ccssctcae.tree raw/intID/outcomes_ccss.txt >> annotation.outcome
node ~/dev/proteinpaint/utils/sjlife2/validate.ctcae.js phenotree/sn.tree raw/intID/subneoplasms.txt >> annotation.outcome
# created "annotation.outcome"
node ~/dev/proteinpaint/utils/sjlife2/precompute.ctcae.js termdb annotation.outcome > chronicevents.precomputed
# created "chronicevents.precomputed"
node ~/dev/proteinpaint/utils/sjlife2/precompute.ctcae.addNotTested.js >> chronicevents.precomputed
# grade=-1 rows appended to indicate "not tested" cases

node ~/dev/proteinpaint/utils/sjlife2/term2subcohort.js termdb annotation.matrix annotation.outcome > term2subcohort
# created "term2subcohort"


#node ~/dev/proteinpaint/utils/sjlife2/phewas.precompute.url.js
#node ~/dev/proteinpaint/utils/sjlife2/category2sample.removegrade9.js category2vcfsample termdb annotation.outcome > category2vcfsample.nograde9

### before running following sqlite commands, softlink the sql scripts to the "clinical/" folder
# the following lines are performed in update.sh
#sqlite3 db < load.sql
#sqlite3 db < set-included-types.sql
# sqlite3 db < anno-by-type.sql

# scp db $ppr:/opt/data/pp/tp_native_dir/files/hg38/sjlife/clinical/
# scp db $prp1:~/data-pp/files/hg38/sjlife/clinical/
