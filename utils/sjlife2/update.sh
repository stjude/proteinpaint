#!/bin/bash

set -e

# scp hpc:~/tp/files/hg38/sjlife/vcf/min/vcf.gz* vcf/
echo "copying tdb.gz from hpc ..."
scp hpc:~/tp/files/hg38/sjlife/tdb.tgz .
tar -xzf tdb.tgz -C ./clinical/

# get the directory of the currently executing script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "updating the db file"
cd clinical
sqlite3 db < $DIR/load.sql
