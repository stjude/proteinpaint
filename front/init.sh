#!/bin/bash

set -e

DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
URL=$1
if [[ "$URL" == "" ]]; then
	URL='.'
fi

# make a public directory where this script was called from
if [[ ! -d public ]]; then
	mkdir public
fi

echo 'Replacing the public/bin bundles ...'
rm -rf public/bin
tar --warning=no-unknown-keyword -xzf $DIR/bundles.tgz -C ./public
mv public/package public/bin

mv ./public/bin/proteinpaint.js ./public/bin/proteinpaint-bk.js
echo "Setting the dynamic bundle path to '${URLPATH}'"
sed "s%__PP_URL__/bin/%${URL}/bin/%" < ./public/bin/proteinpaint-bk.js > public/bin/proteinpaint.js
rm ./public/bin/proteinpaint-bk.js
