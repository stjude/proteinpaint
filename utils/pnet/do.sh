#!/bin/bash

# Call this script from the tp/sdhanda/clinical directory.
# The filepath to the proteinpaint directory will be determined
# from the command line entry and used for the load.sql script.

set -e

# get the directory of the currently executing script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "*** updating the db file ***"
echo "creating tables ..."
sqlite3 db < $DIR/../termdb/create.sql

echo "loading data into tables ..."
sqlite3 db < $DIR/load.sql

echo "updating the terms table"
node $DIR/setterms.bundle.js

echo "updating the ancestry table"
sqlite3 db < $DIR/setancestry.sql

echo "setting the default subcohort ..."
sqlite3 db < $DIR/../termdb/set-default-subcohort.sql

echo "setting the included types ..."
sqlite3 db < $DIR/../termdb/set-included-types.sql

echo "done!"
