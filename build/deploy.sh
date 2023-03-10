#!/bin/bash

# convenience script for building and deploying to SJ hosts
cd build/sj
./deploy.sh "$@"
cd ..
