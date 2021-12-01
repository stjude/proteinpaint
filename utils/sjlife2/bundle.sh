## whenever the clinical data is udpated
## xin will run this from /Users/xzhou1/data/tp/files/hg38/sjlife/clinical/ of his computer
## this deposits a file to hpc:~/tp/files/hg38/sjlife/tdb.tgz
#
tar zcvf ../tdb.tgz a* category2vcfsample chronicevents.precomputed term* samples.idmap keep/* PRS/* phenotree/* raw/intID/*
scp ../tdb.tgz hpc.stjude.org:~/tp/files/hg38/sjlife/
