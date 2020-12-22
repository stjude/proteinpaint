#!/bin/bash

set -e

# 
# Intended as a postversion hook when calling 
# `$ npm version [ patch | minor | major | ... ]`
# 
# or run as `$ ./scripts/publish.sh [ .... see Usage below ... ]`
# 
# This runs a build from a clean work space to ensure that
# all published artifacts are traceable to a git commit.
#

###############
# ARGUMENTS
###############

# default to deploying to ppdev
if (($# == 0)); then
	DEST="dry"
elif (($# == 1)); then
	DEST=$1
fi

if [[ "$DEST" != "dry" && "$DEST" != "registry" && "$DEST" != "tgz"  ]]; then
	echo "Usage:

	./build/publish.sh [ "" | dry | registry | dry | tgz ]

	- no argument defaults to dry
	- dry: equivalent to 'npm publish --dry-run'
	- registry: equivalent to 'npm publish'
	- tgz: equivalent to 'npm pack'
	"
	exit 1
fi

#############################
# EXTRACT FROM COMMIT
# 
# ensure recoverability
#############################

# get commit sha1
REV=$(git rev-parse --short HEAD)
rm -Rf tmppack 
mkdir tmppack # temporary empty workspace for checkedout commit
git archive HEAD | tar -x -C tmppack/
#
# to-do?
# - option to use a customer-specific package that customizes files: [ dataset/*.js ]
# - or apply a hardcoded dataset filter after packing with the tgz option
# 
cp package.json tmppack/
cd tmppack
echo "$REV $(date)" > ./public/rev.txt

# save some time by reusing parent folder's node_modules
# but making sure to update to the committed package.json
ln -s ../node_modules node_modules
# npm update

########
# BUILD
########

# create bundles
echo -e "\nBundling the server bin ...\n"
npm run build-server
echo -e "\nBundling the client bin ...\n"
npx webpack --config=build/webpack.config.build.js --env.url="__PP_URL__"
echo -e "\nPacking the client main ...\n"
npx rollup -c ../build/rollup.config.js



##########
# PUBLISH
##########

if [[ "$DEST" == "dry" ]]; then
	npm publish --dry-run
	cd ..

elif [[ "$DEST" == "registry" ]]; then
	# 
	# to-do? 
	# option to filter the dataset js files
	# to a bare minimum trial experience, so 
	# that the pp-dist package will not expose any
	# sensitive information
	# 
	echo -e "\nTagging remote with $TAG\n"
	# get the current tag
	TAG=$(git tag --points-at HEAD)
	git push origin "$TAG"
	npm publish
	cd ..
	# rm -r tmppack

elif [[ "$DEST" == "tgz" ]]; then
	npm pack
	# delete everything in temp folder except the tar gz file
	find . -type f ! -name '*.tgz' -delete
	find . -type d -delete
	rm node_modules
	cd ..

fi
