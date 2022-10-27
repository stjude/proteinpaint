node msigdb.js ~/data/tp/anno/msigdb/msigdb_v2022.1.Hs_files_to_download_locally/msigdb_v2022.1.Hs.xml ~/data/tp/anno/msigdb/


node updateGenes.js ~/data/tp/anno/msigdb/term2genes ~/data/tp/anno/human.genealias ~/data/tp/anno/tmp/wgEncodeGencodeAttrsV41.txt ~/data/tp/anno/tmp/knownCanonicalGenecode.txt ~/data/tp/anno/tmp/refseq.canonical > ~/data/tp/anno/msigdb/term2genes.updated

cd ../termdb/

node buildTermdb.bundle.js \
        phenotree=/Users/xzhou1/data/tp/anno/msigdb/phenotree \
        termHtmlDef=/Users/xzhou1/data/tp/anno/msigdb/termhtmldef  \
        term2genes=/Users/xzhou1/data/tp/anno/msigdb/term2genes.updated \
        dbfile=/Users/xzhou1/data/tp/anno/msigdb/db
