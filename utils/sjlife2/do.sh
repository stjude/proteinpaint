node ~/proteinpaint/utils/sjlife2/phenotree.parse.atomic.js phenotree/matrix.tree matrix > keep/termjson 2>diagnostic_messages.txt
sh ~/proteinpaint/utils/sjlife2/phenotree.makeentiretree.sh
node ~/proteinpaint/utils/sjlife2/phenotree.parse.term2term.js phenotree/entire.tree keep/termjson
node ~/proteinpaint/utils/sjlife2/subcohort.validateancestry.js ancestry
node ~/proteinpaint/utils/sjlife2/parse.ctcaegradedef.js /Users/xzhou1/data/tp/files/hg38/sjlife/clinical/
mv termdb.updated termdb

node ~/proteinpaint/utils/sjlife2/matrix2db.js matrix > annotation.matrix
node ~/proteinpaint/utils/sjlife2/validate.ctcae.js phenotree/sjlifectcae.tree raw/outcomes_sjlife_3492.txt > annotation.outcome
node ~/proteinpaint/utils/sjlife2/validate.ctcae.js phenotree/ccssctcae.tree raw/outcomes_ccss_2735.txt >> annotation.outcome
node ~/proteinpaint/utils/sjlife2/validate.ctcae.js phenotree/sn.tree raw/subneoplasms_6227.txt >> annotation.outcome
node ~/proteinpaint/utils/sjlife2/precompute.ctcae.js termdb annotation.outcome > chronicevents.precomputed


#node ~/proteinpaint/utils/sjlife2/phewas.precompute.url.js
#node ~/proteinpaint/utils/sjlife2/category2sample.removegrade9.js category2vcfsample termdb annotation.outcome > category2vcfsample.nograde9

 sqlite3 db < load.sql

 node ~/proteinpaint/utils/sjlife2/term2subcohort.js termdb annotation.matrix annotation.outcome > term2subcohort
 sqlite3 db < load.subcohortTerms.sql

# scp db $ppr:/opt/data/pp/tp_native_dir/files/hg38/sjlife/clinical/
# scp db $prp1:~/data-pp/files/hg38/sjlife/clinical/
