# 
# run from the hpc:~/tp/files/hg38/sjlife directory
# 
# as needed, this script will untar the tdb.gz contents to tdb-temp
# 
# !!! scp updated files to hpc:~/tp/files/hg38/sjlife/tdb-temp !!!
# 
# then run hpc-tdb-update.sh
# 

if [[ ! -d tdb-temp ]]; then
	mkdir tdb-temp
	tar xzf tdb.tgz -C ./tdb-temp
fi

cd tdb-temp
tar zcvf ./tdb.tgz a* category2vcfsample chronicevents.precomputed term* samples.idmap keep/* PRS/* phenotree/* term2subcohort
