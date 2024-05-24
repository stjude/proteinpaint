#!/bin/bash
# syntax: ./install_pp.sh -g hg19,hg38 -t /path/to/pp_data

set -euo pipefail

USAGE="Usage:
	./install_pp.sh [-g] [-tp] 

	-g GENOME BUILDS: (hg19/hg38) Separate multiple genome builds using ','; Currently only support hg19 and hg38. Will add other genome builds later. 
	-t TP_DIRECTORY: Path to tp directory
"

#################
# PROCESSED ARGS
#################

BUILDS=""
TP=""
while getopts ":g:t:h:" opt; do
	case "${opt}" in
	g)      BUILDS=${OPTARG}
                ;;
	t)
		TP_FOLDER=${OPTARG}
		;;
	h)
		echo "$USAGE"
		exit 1
		;;
        *)
  	        echo "Unrecognized parameter. Use -h to display usage."
  	        exit 1
  	        ;;
	esac
done

# Download docker image and run it

TAG=latest # can change to a version number like 2.11.2
IMAGE_NAME=ghcr.io/stjude/ppfull:$TAG # may use ppserver:$TAG for server-only image
docker pull $IMAGE_NAME

# download the run helper scripts
wget https://raw.githubusercontent.com/stjude/proteinpaint/master/container/run.sh
wget https://raw.githubusercontent.com/stjude/proteinpaint/master/container/createPPNetwork.sh
wget https://raw.githubusercontent.com/stjude/proteinpaint/master/container/verify.sh
wget https://raw.githubusercontent.com/stjude/proteinpaint/master/container/validateConfig.js
chmod a+x *

echo "BUILDS:$BUILDS"
echo "TP_FOLDER:$TP_FOLDER"

if echo "$BUILDS" | grep -q ","; then # Check if multiple genome builds are present or not
    delimiter=","
    # Save the original IFS value so it can be restored later
    old_ifs="$IFS"
    # Set IFS to the desired delimiter
    IFS="$delimiter"
    # Split the string and read into an array
    read -ra array <<< "$BUILDS"
    # Restore the original IFS value
    IFS="$old_ifs"
else # Single genome build
    array="$BUILDS"
fi

hg19=false
hg38=false
# Iterating through all genome builds
num_genome_builds=0
for element in "${array[@]}"; do
    echo "$element"
    if [ "$element" = "hg19" ]; then
        echo "This is hg19"
	hg19=true
	echo $hg19
	num_genome_builds=$((num_genome_builds+1))
    elif [ "$element" = "hg38" ]; then
        echo "This is hg38"
	hg38=true
	echo $hg38
	num_genome_builds=$((num_genome_builds+1))
    else
	echo "None of these"
	exit 1
    fi	
done

echo $num_genome_builds
# Create serverconfig.json file

if [ $num_genome_builds -eq 0 ]; then
    echo "No applicable reference genome build specified"
    exit 1
fi    

echo '{' > serverconfig.json
echo '   "debugmode": true,' >> serverconfig.json
echo '   "defaultgenome": "hg38",' >> serverconfig.json
echo '   "genomes": [' >> serverconfig.json

# For now, restricting only to human reference genome builds
if [[ "$hg19" = true && "$hg38" = false ]]; then
    echo '       {' >> serverconfig.json
    echo '          "name": "hg19",' >> serverconfig.json
    echo '          "species": "human",' >> serverconfig.json
    echo '          "file": "./genome/hg19.js",' >> serverconfig.json
    echo '          "datasets": []' >> serverconfig.json
    echo '       }' >> serverconfig.json
elif [[ "$hg38" = true && "$hg19" = false ]]; then    
    echo '       {' >> serverconfig.json
    echo '          "name": "hg38",' >> serverconfig.json
    echo '          "species": "human",' >> serverconfig.json
    echo '          "file": "./genome/hg38.js",' >> serverconfig.json
    echo '          "datasets": []' >> serverconfig.json
    echo '       }' >> serverconfig.json
elif [[ "$hg38" = true && "$hg19" = true ]]; then
    echo '       {' >> serverconfig.json
    echo '          "name": "hg19",' >> serverconfig.json
    echo '          "species": "human",' >> serverconfig.json
    echo '          "file": "./genome/hg19.js",' >> serverconfig.json
    echo '          "datasets": []' >> serverconfig.json
    echo '       },' >> serverconfig.json
    echo '       {' >> serverconfig.json
    echo '          "name": "hg38",' >> serverconfig.json
    echo '          "species": "human",' >> serverconfig.json
    echo '          "file": "./genome/hg38.js",' >> serverconfig.json
    echo '          "datasets": []' >> serverconfig.json
    echo '       }' >> serverconfig.json    
fi    

echo '   ],' >> serverconfig.json
echo "   \"tpmasterdir\": \"${TP}\"," >> serverconfig.json
echo "   \"cachedir\": \"${TP}\"," >> serverconfig.json # For now using TP dir as cache dir
echo "   \"URL\": \"http://localhost:3456\"," >> serverconfig.json
echo "   \"gfClient\": \"/home/root/pp/tools/gfClient\"," >> serverconfig.json
echo "   \"port\": 3000," >> serverconfig.json
echo "   \"backend_only\": false" >> serverconfig.json
echo "}" >> serverconfig.json

CURRENT_DIR=$PWD

# Create TP dir if not present
if [[ ! -d "$TP_FOLDER" ]]; then
  mkdir -p $TP_FOLDER
fi
cd $TP_FOLDER
mkdir -p genomes/ anno/db/ anno/msigdb/ hg19/ hg38/ utils/meme/motif_databases/HUMAN/

cd genomes/
if [ "$hg19" = true ]; then
   curl https://proteinpaint.stjude.org/ppGenomes/hg19.gz -O
   curl https://proteinpaint.stjude.org/ppGenomes/hg19.gz.fai -O
   curl https://proteinpaint.stjude.org/ppGenomes/hg19.gz.gzi -O
fi    

if [ "$hg38" = true ]; then
   curl https://proteinpaint.stjude.org/ppGenomes/hg38.gz -O
   curl https://proteinpaint.stjude.org/ppGenomes/hg38.gz.fai -O
   curl https://proteinpaint.stjude.org/ppGenomes/hg38.gz.gzi -O
fi    

cd ../anno/
if [ "$hg19" = true ]; then
   curl https://proteinpaint.stjude.org/ppSupport/refGene.hg19.gz -O
   curl https://proteinpaint.stjude.org/ppSupport/refGene.hg19.gz.tbi -O
   curl https://proteinpaint.stjude.org/ppSupport/gencode.v40.hg19.gz -O
   curl https://proteinpaint.stjude.org/ppSupport/gencode.v40.hg19.gz.tbi -O
   curl https://proteinpaint.stjude.org/ppSupport/genes.hg19.db -O
   curl https://proteinpaint.stjude.org/ppSupport/rmsk.hg19.gz -O
   curl https://proteinpaint.stjude.org/ppSupport/rmsk.hg19.gz.tbi -O
fi

if [ "$hg38" = true ]; then
   curl https://proteinpaint.stjude.org/ppSupport/refGene.hg38.gz -O
   curl https://proteinpaint.stjude.org/ppSupport/refGene.hg38.gz.tbi -O
   curl https://proteinpaint.stjude.org/ppSupport/gencode.v43.hg38.gz -O
   curl https://proteinpaint.stjude.org/ppSupport/gencode.v43.hg38.gz.tbi -O
   curl https://proteinpaint.stjude.org/ppSupport/genes.hg38.db -O
   curl https://proteinpaint.stjude.org/ppSupport/rmsk.hg38.gz -O
   curl https://proteinpaint.stjude.org/ppSupport/rmsk.hg38.gz.tbi -O
fi    

cd db/
curl https://proteinpaint.stjude.org/ppSupport/db/proteindomain.db -O

cd ../msigdb/
curl https://proteinpaint.stjude.org/ppSupport/msigdb/db_2023.2.Hs -O

cd $CURRENT_DIR
# Run the docker image
./run.sh $IMAGE_NAME
