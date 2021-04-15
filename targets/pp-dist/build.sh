#!/bin/bash

set -e

###############
# ARGUMENTS
###############

usage() {
	echo "Usage:

	./targets/pp-dist/build.sh [-r]

	-r REV: git revision to checkout, if empty will use the current code state
	"
}

REV=latest
while getopts "rh" opt; do
	case "${opt}" in
	r)
		REV=${OPTARG}
		;;
	h)
		usage
		exit 1
		;;
	esac
done

#############################
# EXTRACT FROM COMMIT
#############################

if [[ "$REV" != 'latest' ]]; then
	./build/tmp.sh $REV
	cd tmppack
	npm run reset
fi

cd server
echo -e "\nCreating the server bundle\n"
npx webpack --config=webpack.config.js

cd ../client
echo -e "\nBundling the client browser bin ...\n"
rm -rf ../public/bin
npx webpack --config=webpack.config.js --env.url="__PP_URL__"
echo -e "\nPacking the client module main ...\n"
rm -rf dist
npx rollup -c ./rollup.config.js
sed -i.bak 's%proteinpaint-client%proteinpaint%' package.json

cd ..

##########
# PACK
##########

mv package.json package.bk.json
./targets/pp-dist/editpkgjson.js > package.json
npm pack 
rm package.json
mv package.bk.json package.json

#####################
# Build Docker Image
#####################

# get the current tag
TAG="$(node -p "require('./package.json').version")"

docker build --file ./build/Dockerfile --tag ppbase:$REV .
docker build --file ./targets/pp-dist/Dockerfile --tag ppdist:$REV --build-arg PKGVER=$TAG .
