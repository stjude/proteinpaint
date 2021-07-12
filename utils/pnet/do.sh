#!/bin/bash

# Call this script from the tp/sdhanda/clinical directory.
# The filepath to the proteinpaint directory will be determined
# from the command line entry and used for the load.sql script.

set -e

# get the directory of the currently executing script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "updating the db file"

sqlite3 db < $DIR/create.sql
sqlite3 db < $DIR/load.sql
node $DIR/setterms.js
