#!/bin/bash

npx webpack
scp buildTermdb.bundle.js extractFromStudyJson.js *.sql hpc:~/tp/termdb/
