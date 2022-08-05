#!/bin/bash

npx webpack
scp buildTermdb.bundle.js *.sql hpc:~/tp/termdb/
