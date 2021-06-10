node ~/proteinpaint/utils/sjlife2/update2matrix.js raw/ccssrename/updatematrix.csv > matrix.stringID
node ~/proteinpaint/utils/sjlife2/matrix.string2intID.js > matrix
# "matrix" is now using integer sample id
# also makes "samples.idmap"

node ~/proteinpaint/utils/sjlife2/matrix2db.js matrix > annotation.matrix
cat PRS/annotation.scores >> annotation.matrix

node ~/proteinpaint/utils/sjlife2/replace.sampleid.js raw/outcomes_sjlife.txt 0 > raw/intID/outcomes_sjlife.txt
node ~/proteinpaint/utils/sjlife2/replace.sampleid.js raw/ccssrename/outcomes_ccss.txt 0 > raw/intID/outcomes_ccss.txt
node ~/proteinpaint/utils/sjlife2/replace.sampleid.js raw/ccssrename/subneoplasms.txt 0,1 > raw/intID/subneoplasms.txt

node ~/proteinpaint/utils/sjlife2/replace.sampleid.js raw/sjlife.admix 0 > annotation.admix.sjlife
node ~/proteinpaint/utils/sjlife2/replace.sampleid.js raw/ccssrename/ccss.admix 0 > annotation.admix.ccss

node ~/proteinpaint/utils/sjlife2/binconfig.ageterms.js termdb keep/manual.termconfig > keep/termconfig
node ~/proteinpaint/utils/sjlife2/phenotree.parse.atomic.js phenotree/matrix.tree matrix keep/termconfig > keep/termjson 2>diagnostic_messages.txt
sh ~/proteinpaint/utils/sjlife2/phenotree.makeentiretree.sh
node ~/proteinpaint/utils/sjlife2/phenotree.2phewastermlist.js phenotree/entire.tree > alltermsbyorder.grouped
node ~/proteinpaint/utils/sjlife2/phenotree.parse.term2term.js phenotree/entire.tree keep/termjson

node ~/proteinpaint/utils/sjlife2/subcohort.validateancestry.js ancestry
cat PRS/ancestry.prs >> ancestry

node ~/proteinpaint/utils/sjlife2/parse.ctcaegradedef.js /Users/xzhou1/data/tp/files/hg38/sjlife/clinical/
mv termdb.updated termdb
cat PRS/termdb.prs >> termdb

node ~/proteinpaint/utils/sjlife2/validate.ctcae.js phenotree/sjlifectcae.tree raw/intID/outcomes_sjlife.txt > annotation.outcome
node ~/proteinpaint/utils/sjlife2/validate.ctcae.js phenotree/ccssctcae.tree raw/intID/outcomes_ccss.txt >> annotation.outcome
node ~/proteinpaint/utils/sjlife2/validate.ctcae.js phenotree/sn.tree raw/intID/subneoplasms.txt >> annotation.outcome
node ~/proteinpaint/utils/sjlife2/precompute.ctcae.js termdb annotation.outcome > chronicevents.precomputed
node ~/proteinpaint/utils/sjlife2/term2subcohort.js termdb annotation.matrix annotation.outcome > term2subcohort


#node ~/proteinpaint/utils/sjlife2/phewas.precompute.url.js
#node ~/proteinpaint/utils/sjlife2/category2sample.removegrade9.js category2vcfsample termdb annotation.outcome > category2vcfsample.nograde9

#sqlite3 db < load.sql


# scp db $ppr:/opt/data/pp/tp_native_dir/files/hg38/sjlife/clinical/
# scp db $prp1:~/data-pp/files/hg38/sjlife/clinical/
