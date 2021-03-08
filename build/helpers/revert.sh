#!/bin/bash

set -e

./helpers/activate.sh -1
ACTIVEREV=$(cat active/public/rev.txt | cut -d' ' -f 2)
./helpers/erase.sh $ACTIVEREV

