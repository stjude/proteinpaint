#!/bin/bash

set -e

if [[ "$1" == "server" ]]; then 
	./run.sh ppserver:latest pp
else 
	./run.sh ppfull:latest pp
fi
