node msigdb.js ~/data/tp/msigdb/msigdb_v7.5.1.xml
cd ../termdb/
node buildTermdb.bundle.js phenotree=../msigdb/phenotree termHtmlDef=../msigdb/termhtmldef dbfile=~/data/tp/msigdb/db
cd ../msigdb/
sqlite3 ~/data/tp/msigdb/db < loadTables.sql
