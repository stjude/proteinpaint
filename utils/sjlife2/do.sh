node ~/proteinpaint/utils/sjlife2/phenotree.parse.term2term.js phenotree keep/termjson
node ~/proteinpaint/utils/sjlife2/parse.ctcaegradedef.js /Users/xzhou1/data/tp/files/hg38/sjlife/clinical/
mv termdb.updated termdb

node ~/proteinpaint/utils/sjlife2/matrix2db.js matrix > annotation.matrix
node ~/proteinpaint/utils/sjlife2/validate.ctcae.js phenotree raw/outcomes_2017.txt > annotation.outcome
node ~/proteinpaint/utils/sjlife2/precompute.ctcae.js termdb annotation.outcome ~/proteinpaint/dataset/sjlife2.hg38.js > chronicevents.precomputed

#node ~/proteinpaint/utils/sjlife2/phewas.precompute.url.js
#node ~/proteinpaint/utils/sjlife2/category2sample.removegrade9.js category2vcfsample termdb annotation.outcome > category2vcfsample.nograde9

# sqlite3 db < load.sql

# scp db $ppr:/opt/data/pp/tp_native_dir/files/hg38/sjlife/clinical/
# scp db $prp1:~/data-pp/files/hg38/sjlife/clinical/
