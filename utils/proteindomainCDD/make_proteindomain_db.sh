#!/bin/bash
set -e
set -u
set -o pipefail

##########################################
#
# Make a protein domain database for a given species
#
##########################################

#Objective: make a protein domain database for a given species. Retrieve protein domains from NCBI, Ensembl, and manually curated sources. Accepted species are human, mouse, and zebrafish.

#Usage: bash make_proteindomain_db.sh <species>
#<species>: "human", "mouse", or "zebrafish"

#Verify number of arguments
if [[ "$#" -ne 1 ]]
then
    echo "Usage: bash make_proteindomain_db.sh <species>"
    echo "<species>: human, mouse, or zebrafish"
    exit 2
fi

species=$1

#Verify species
if [[ "$species" != "human" && "$species" != "mouse" && "$species" != "zebrafish" ]]
then
    echo "The specificed species is not supported. Only human, mouse, and zebrafish are supported."
    exit 2
fi

#Verify that the pybiomart Python package is installed
if ! python3 -c "from pybiomart import *"
then
    echo "The Python package \"pybiomart\" was not found. See \"readMe\" file for installation instructions."
    exit 2
fi


#1. Download protein files from NCBI. Files will be stored in the "CDD_NCBI_<species>" folder.
python3 NCBICDD_Download.py $species


#2. Generate <species>_CDD.Json
# . Add manually curated protein domain only for human
# . Will cause error and exit running process if protein_manuallyCurated.json missed from current directory when species is human
# . ISO screening and generate <species>_CDD.Json. Only keep the preferred isoform listed in ISOLIST if provided
    # . ISOLIST file "your prefered isoform accession ID file with one id each row"   
    # . If not ISOLIST file in current directory, all isoform will be included
#Add parameter of --cddid to include only domains with cdd id

if [ $species == 'human' ]; then
	python3 CDD_Annotation.py -p CDD_NCBI_$species -s $species --isoform ISOLIST --cddid
else
	python3 CDD_Annotation.py -p CDD_NCBI_$species -s $species --cddid
fi


#3. Download domain tables for Ensembl genes
# . Will download CDD, PFAM, SMART, and TIGRFAM domain tables
python3 ensembl_download.py --species $species


#4. Generate Ensembl_domain_<species>.json
python3 Ensembl_CDD.py -s $species ensembl_CDD_$species.gz ensembl_Pfam_$species.gz ensembl_smart_$species.gz ensembl_tigrfam_$species.gz


#5. Merge NCBI and Ensembl domains
cat ${species}_CDD.Json Ensembl_domain_$species.json >proteindomain_$species.json

#6. If species is human, add the mitochondrial domains (mt.domain) and the Znf domains (NM_006060_proteindomain) to the JSON file
if [ $species == 'human' ]; then
	cat mt.domain >>proteindomain_$species.json
	cat NM_006060_proteindomain >>proteindomain_$species.json
fi

#7. Build the protein domain database 
cat proteindomain.sql >proteindomain_$species.sql
echo ".import proteindomain_${species}.json domain" >>proteindomain_$species.sql
echo "CREATE INDEX domain_isoform on domain(isoform collate nocase);" >>proteindomain_$species.sql
sqlite3 proteindomain_$species.db <proteindomain_$species.sql 

rm -f cddid.tbl


