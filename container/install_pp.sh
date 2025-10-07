#!/bin/bash

## NOTE: This script installs the ProteinPaint server and supporting data for a new user. Currently, it only supports hg19 and hg38 reference genome builds and will add other genome builds later. The only tool that is setup currently is BAM track. 

## The script does the following:

# 1. download the supporting data (e.g reference genome build data) if it is not already present. 
# 2. download the docker image and run it. The script will also download the run helper scripts if they are not already present. 
# 3. create the serverconfig.json file based on the genome builds specified. The script will also create the data directory (data_directory) if it is not already present, alongwith the directory structure and download the supporting data if it is not already present. 

## To run a local instance of PP, do the following:

# 1. first cd into 'data_directory' and download the install_pp.sh script using the command:
# wget https://raw.githubusercontent.com/stjude/proteinpaint/master/container/install_pp.sh
# 2. then under the same 'data_directory' run the script using the command:
# sh ./install_pp.sh -g hg19,hg38 -t /path/to/data_directory
# 3. Now on your browser, go to http://localhost:3456 to access the ProteinPaint server.
# 4. After finishing analyzing data using PP, the docker image can be stopped using the command: docker stop pp && docker rm pp
set -euo pipefail

USAGE="Usage:
	./install_pp.sh [-g] [-t] [-d] [-v] 

	-g GENOME BUILDS: (hg19/hg38) Separate multiple genome builds using ','; Currently only support hg19 and hg38. Will add other genome builds later. 
	-t TP_DIRECTORY: Path to tp directory
        -d DOWNLOAD SUPPORTING DATA (optional)(true/false): Is supporting data (e.g reference genome build data) already present? If false, then no download will occur
        -v VERSION NUMBER (optional): VERSION of PP build. By default it uses "'latest'"
"

#################
# PROCESSED ARGS
#################

BUILDS=""
TP=""
DOWNLOAD=true
TAG=latest # can change to a version number like 2.11.2
while getopts ":g:t:h:d:v:" opt; do
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
	d)	if [[ ${OPTARG} = true || ${OPTARG} = false ]]; then
                    DOWNLOAD=${OPTARG}
		else
		    echo "-e=${OPTARG} not supported, must be 'true' or 'false'"
		    echo "$USAGE"
		    exit 1
		fi    
		;;
	v)    TAG=${OPTARG}
		;;
        *)
  	        echo "Unrecognized parameter. Use -h to display usage."
  	        exit 1
  	        ;;
	esac
done

# Download docker image and run it

IMAGE_NAME=ghcr.io/stjude/ppfull:$TAG # may use ppserver:$TAG for server-only image
docker pull $IMAGE_NAME || exit 1 # It can fail if the TAG is not correct

# download the run helper scripts
if [[ ! -f "run.sh" ]]; then
  wget https://raw.githubusercontent.com/stjude/proteinpaint/master/container/run.sh
fi
if [[ ! -f "createPPNetwork.sh" ]]; then
  wget https://raw.githubusercontent.com/stjude/proteinpaint/master/container/createPPNetwork.sh
fi
if [[ ! -f "verify.sh" ]]; then
  wget https://raw.githubusercontent.com/stjude/proteinpaint/master/container/verify.sh
fi
if [[ ! -f "validateConfig.cjs" ]]; then
  wget https://raw.githubusercontent.com/stjude/proteinpaint/master/container/validateConfig.cjs
fi
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
	hg19=true
	num_genome_builds=$((num_genome_builds+1))
    elif [ "$element" = "hg38" ]; then
	hg38=true
	num_genome_builds=$((num_genome_builds+1))
    else
	echo "None of the genome builds currently available"
	exit 1
    fi	
done

echo $num_genome_builds

# Create a serverconfig.json file (required by the PP server)
if [ $num_genome_builds -eq 0 ]; then
    echo "No applicable reference genome build specified"
    exit 1
fi    

echo '{' > serverconfig.json
echo '   "debugmode": true,' >> serverconfig.json
echo '   "defaultgenome": "hg38",' >> serverconfig.json
echo '   "genomes": [' >> serverconfig.json

# Download the genome builds
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
echo "   \"tpmasterdir\": \"${TP_FOLDER}\"," >> serverconfig.json
echo "   \"cachedir\": \"${TP_FOLDER}/cache_dir\"," >> serverconfig.json
echo "   \"URL\": \"http://localhost:3456\"," >> serverconfig.json
echo "   \"gfClient\": \"/home/root/pp/tools/gfClient\"," >> serverconfig.json
echo "   \"port\": 3000," >> serverconfig.json
echo "   \"backend_only\": false" >> serverconfig.json
echo "}" >> serverconfig.json

CURRENT_DIR=$PWD

# Create TP directory if not present
if [[ ! -d "$TP_FOLDER" ]]; then
  mkdir -p $TP_FOLDER
fi
# Create cache directory if not present
if [[ ! -d "${TP_FOLDER}/cache_dir" ]]; then
  mkdir -p $TP_FOLDER/cache_dir
fi
cd $TP_FOLDER
if [ "$DOWNLOAD" = true ]; then
   curl https://proteinpaint.stjude.org/ppSupport/ppdemo_bam.tar.gz -O # This tarball only contains the BAM slices which are shown in http://proteinpaint.stjude.org/bam 
   tar zxvf ppdemo_bam.tar.gz # Releases the "proteinpaint_demo/" folder under $TP_FOLDER 
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
      curl https://proteinpaint.stjude.org/ppSupport/dbsnp-slice/dbsnp.hg19.bb -O
   fi
   
   if [ "$hg38" = true ]; then
      curl https://proteinpaint.stjude.org/ppSupport/refGene.hg38.gz -O
      curl https://proteinpaint.stjude.org/ppSupport/refGene.hg38.gz.tbi -O
      curl https://proteinpaint.stjude.org/ppSupport/gencode.v43.hg38.gz -O
      curl https://proteinpaint.stjude.org/ppSupport/gencode.v43.hg38.gz.tbi -O
      curl https://proteinpaint.stjude.org/ppSupport/genes.hg38.db -O
      curl https://proteinpaint.stjude.org/ppSupport/rmsk.hg38.gz -O
      curl https://proteinpaint.stjude.org/ppSupport/rmsk.hg38.gz.tbi -O
      curl https://proteinpaint.stjude.org/ppSupport/dbsnp-slice/dbsnp.hg38.bb -O
   fi    

   curl https://proteinpaint.stjude.org/ppSupport/hicfiles.tgz -O
   tar zxvf hicfiles.tgz # Releases the "hicFragment/" and "hicTAD/" folders under anno/
   cd db/
   curl https://proteinpaint.stjude.org/ppSupport/db/proteindomain.db -O
   
   cd ../msigdb/
   curl https://proteinpaint.stjude.org/ppSupport/msigdb/db_2023.2.Hs -O

   cd ../../utils/meme/motif_databases/HUMAN/
   curl https://proteinpaint.stjude.org/ppSupport/HOCOMOCOv11_full_HUMAN_mono_meme_format.meme -O
   curl https://proteinpaint.stjude.org/ppSupport/HOCOMOCOv11_full_annotation_HUMAN_mono.tsv -O
fi

cd $CURRENT_DIR

# Run the docker image
./run.sh $IMAGE_NAME
