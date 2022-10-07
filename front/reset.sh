#!/bin/bash

set -e

URL=$1
if [[ "$URL" == "" ]]; then
	URL='.'
fi

if [[ ! -d public ]]; then
	mkdir public
fi

echo 'Replacing the public/bin bundles ...'
rm -rf public/bin
cp -r /node_modules/@stjude/proteinpaint-front/public/bin public/

mv ./public/bin/proteinpaint.js ./public/bin/proteinpaint-bk.js
echo "Setting the dynamic bundle path to '${URLPATH}'"
sed "s%__PP_URL__/bin/%${URL}/bin/%" < ./public/bin/proteinpaint-bk.js > public/bin/proteinpaint.js
rm ./public/bin/proteinpaint-bk.js
