#!/bin/bash

set -e

#
# NOTES
# - called from project root, e.g., `./scripts/deploy.sh $ENV`
#

########################
# PROCESS COMMIT INFO
########################

# convert $REV to standard numeric notation
if [[ $REV=="HEAD" ]]; then
	if [[ -d .git ]]; then
		REV=$(git rev-parse --short HEAD)
	fi
fi

if [[ "$REV" == "HEAD" || "$REV" == "" ]]; then
	echo "Unable to convert the HEAD revision into a Git commit hash."
	exit 1
fi

#################################
# EXTRACT AND BUILD FROM COMMIT
#################################

<<eof
rm -Rf tmpbuild
# remote repo not used, use local repo for now
mkdir tmpbuild
git archive HEAD | tar -x -C tmpbuild/

cd tmpbuild
ln -s ../node_modules node_modules
eof

rm -Rf pp-server
mkdir pp-server

./node_modules/babel-cli/bin/babel.js -q server.js --out-file server.min.js # | ./node_modules/uglify-es/bin/uglifyjs --compress --mangle --output server.min.js

webpack --config=./scripts/webpack.config.server.js

cd pp-server
ln -s ../node_modules ./node_modules

cd ..x
mv server.js server-0.js
cp pp-server/server.js ./server.js

# cleanup
# rm server-dist*.js
# rm -Rf pp-server


