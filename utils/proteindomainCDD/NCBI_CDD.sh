#!/bin/bash


#1. download protein file from NCBI (CDD_NCBI new folder where protein file will be stored)
python3 NCBICDD_Download.py


#2. generate Homo_sapiens_CDD.Json
# . add manually curated protein domain
# . Will cause error and exit running process if protein_manuallyCurated.json missed from current directory
# . ISO screening and generate Homo_sapiens_CDD.Json. Only keep the preferred isoform listed in ISOLIST
    # . ISOLIST file "your prefered isoform accession ID file with one id each row"   
    # . if not ISOLIST file in current directory, the script will ask if you want all isoform, you need to input "y" through keyboard, otherwise the process will be aborted with error info
python3 CDD_Annotation.py -p CDD_NCBI -s Homo_sapiens 

#3. generate Ensembl_domain.json
#domain tables including at least one of the following tables is required before running this script.
#CDD, Pfam, SMART and TIGRFAM
#domain table includes ensembl transcript ID, gene name, Domain ID, aa start, aa end
#where to down CDD domain table:
#http://useast.ensembl.org/biomart/martview/0b33cafdaebd19673cc93f70f64b6ccd

DomainFile=("ensembl_CDD.gz" "ensembl_Pfam.gz" "ensembl_smart.gz" "ensembl_tigrfam.gz" "ensembl_CDD" "ensembl_Pfam" "ensembl_smart" "ensembl_tigrfam")
DomainFileCK=0
for i in "${DomainFile[@]}"
do
        if test -f "${i}"; then
                DomainFileCK=1
        fi
done
if [ $DomainFileCK = 1 ]; then
	python3 Ensembl_CDD.py ensembl_CDD.gz ensembl_Pfam.gz ensembl_smart.gz ensembl_tigrfam.gz
else
	echo 'Error: Ensembl domain tables including at least one of the following tables is required before running this script'
	echo 'CDD, Pfam, SMART and TIGRFAM'
	echo 'http://useast.ensembl.org/biomart/martview/0b33cafdaebd19673cc93f70f64b6ccd'
	exit
fi


#4. merge domain for refseq and ensembl genes
cat Homo_sapiens_CDD.Json Ensembl_domain.json >proteindomain.json

#5. sqlite db 
sqlite3 proteindomain.db <proteindomain.sql 


