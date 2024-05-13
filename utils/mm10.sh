#!/bin/bash

if [[ $1 == "" ]]; then
    echo "No data folder specified, using current directory as data folder"
    TP_FOLDER=$PWD
else
    TP_FOLDER=$1
fi

if [[ ! -d $TP_FOLDER ]]
then
    echo "$TP_FOLDER does not exists on your filesystem, creating one."
    exit 1 
fi

cd $TP_FOLDER


if [[ ! -d "genomes" ]]
then
    echo "genomes folder does not exists on your filesystem, creating one."
    mkdir -p genomes
fi

cd genomes
curl https://proteinpaint.stjude.org/ppGenomes/mm10.gz -O
curl https://proteinpaint.stjude.org/ppGenomes/mm10.gz.fai -O
curl https://proteinpaint.stjude.org/ppGenomes/mm10.gz.gzi -O

cd ../
if [[ ! -d "anno" ]]
then
    echo "anno folder does not exists on your filesystem, creating one."
    mkdir -p anno
fi
cd anno
curl https://proteinpaint.stjude.org/ppSupport/refGene.mm10.gz -O
curl https://proteinpaint.stjude.org/ppSupport/refGene.mm10.gz.tbi -O
curl https://proteinpaint.stjude.org/ppSupport/rmsk.mm10.gz -O
curl https://proteinpaint.stjude.org/ppSupport/rmsk.mm10.gz.tbi -O
curl https://proteinpaint.stjude.org/ppSupport/genes.mm10.db -O

if [[ ! -d "hicFragment" ]]
then
    echo "hicFragment folder does not exists on your filesystem."
    mkdir -p hicFragment 
fi
cd hicFragment
curl https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.DpnII.mm10.gz -O
curl https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.DpnII.mm10.gz.tbi -O
curl https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.EcoRI.mm10.gz -O
curl https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.EcoRI.mm10.gz.tbi -O
curl https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.HindIII.mm10.gz -O
curl https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.HindIII.mm10.gz.tbi -O
curl https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.MboI.mm10.gz -O
curl https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.MboI.mm10.gz.tbi -O
curl https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.NcoI.mm10.gz -O
curl https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.NcoI.mm10.gz .tbi -O

