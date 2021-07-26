set -e
set -u
set -o pipefail

###############################################
# procedures to build database table files
# on mac, run `brew install csvkit` first to get the "csvformat" command

node ~/proteinpaint/utils/sjlife2/update2matrix.js raw/updatematrix.csv > matrix.stringID
# created "matrix.stringID"
node ~/proteinpaint/utils/sjlife2/matrix.string2intID.js > matrix
# created "samples.idmap"
# created "matrix", now using integer sample id

node ~/proteinpaint/utils/sjlife2/matrix2db.js matrix > annotation.matrix
# created "annotation.matrix"
node ~/proteinpaint/utils/sjlife2/replace.sampleid.js PRS/annotation.scores 0 >> annotation.matrix
# appended to "annotation.matrix"

node ~/proteinpaint/utils/sjlife2/replace.sampleid.js raw/outcomes_sjlife.txt 0 yes > raw/intID/outcomes_sjlife.txt
node ~/proteinpaint/utils/sjlife2/replace.sampleid.js raw/outcomes_ccss.txt 0 yes > raw/intID/outcomes_ccss.txt
node ~/proteinpaint/utils/sjlife2/replace.sampleid.js raw/subneoplasms.txt 0,1 yes > raw/intID/subneoplasms.txt
# created 3 files under raw/intID/

node ~/proteinpaint/utils/sjlife2/replace.sampleid.js raw/sjlife.admix 0 > annotation.admix.sjlife
node ~/proteinpaint/utils/sjlife2/replace.sampleid.js raw/ccss.admix 0 > annotation.admix.ccss
# created "annotation.admix.sjlife" and "annotation.admix.ccss"

#node ~/proteinpaint/utils/sjlife2/binconfig.ageterms.js termdb keep/manual.termconfig > keep/termconfig
# created "keep/termconfig"

node ~/proteinpaint/utils/sjlife2/remove.doublequote.js phenotree/matrix.tree
node ~/proteinpaint/utils/sjlife2/remove.doublequote.js phenotree/ccssctcae.tree
node ~/proteinpaint/utils/sjlife2/remove.doublequote.js phenotree/sjlifectcae.tree
node ~/proteinpaint/utils/sjlife2/remove.doublequote.js phenotree/sn.tree
# updated files in-place

node ~/proteinpaint/utils/sjlife2/phenotree.parse.atomic.js phenotree/matrix.tree matrix # keep/termconfig 
# created "keep/termjson"
# created "diagnostic_messages.txt"

sh ~/proteinpaint/utils/sjlife2/phenotree.makeentiretree.sh
# created "phenotree/entire.tree"

node ~/proteinpaint/utils/sjlife2/phenotree.2phewastermlist.js phenotree/entire.tree > alltermsbyorder.grouped
# created "alltermsbyorder.grouped"

node ~/proteinpaint/utils/sjlife2/phenotree.parse.term2term.js phenotree/entire.tree keep/termjson
# created "ancestry"
# overwritten "termdb"

cat PRS/ancestry.prs >> ancestry
node ~/proteinpaint/utils/sjlife2/subcohort.validateancestry.js ancestry

node ~/proteinpaint/utils/sjlife2/parse.ctcaegradedef.js
# created "termdb.updated"
# created "termid2htmldef"
mv termdb.updated termdb
node ~/proteinpaint/utils/sjlife2/validate.termdbfile.js PRS/termdb.prs >> termdb

node ~/proteinpaint/utils/sjlife2/validate.ctcae.js phenotree/sjlifectcae.tree raw/intID/outcomes_sjlife.txt > annotation.outcome
node ~/proteinpaint/utils/sjlife2/validate.ctcae.js phenotree/ccssctcae.tree raw/intID/outcomes_ccss.txt >> annotation.outcome
node ~/proteinpaint/utils/sjlife2/validate.ctcae.js phenotree/sn.tree raw/intID/subneoplasms.txt >> annotation.outcome
# created "annotation.outcome"
node ~/proteinpaint/utils/sjlife2/precompute.ctcae.js termdb annotation.outcome > chronicevents.precomputed
# created "chronicevents.precomputed"
node ~/proteinpaint/utils/sjlife2/term2subcohort.js termdb annotation.matrix annotation.outcome > term2subcohort
# created "term2subcohort"


#node ~/proteinpaint/utils/sjlife2/phewas.precompute.url.js
#node ~/proteinpaint/utils/sjlife2/category2sample.removegrade9.js category2vcfsample termdb annotation.outcome > category2vcfsample.nograde9

#sqlite3 db < load.sql


# scp db $ppr:/opt/data/pp/tp_native_dir/files/hg38/sjlife/clinical/
# scp db $prp1:~/data-pp/files/hg38/sjlife/clinical/
