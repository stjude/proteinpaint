#!/bin/bash

# call from the project root
#

ROUTESDIR=$1
if [[ ! -d $ROUTESDIR ]]; then
	echo "invalid routes directory"
	exit 1
fi

TYPESDIR=$2
if [[ ! -d $TYPESDIR ]]; then
	echo "invalid types directory"
	exit 1
fi

CHECKERSDIR=$3
CHECKERSRAW=$CHECKERSDIR-raw

DOCSDIR=$4

IMPORTRELPATH=$(python3 -c "import os.path; print(os.path.relpath('$TYPESDIR', '$CHECKERSDIR'))")

echo "creating type checker code at $CHECKERSDIR, for routes in $ROUTESDIR ..."
echo "[$PWD] [$ROUTESDIR] [$TYPESDIR] [$CHECKERSDIR] [$DOCSDIR]"
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
# echo "SCRIPT_DIR=[$SCRIPT_DIR]"

# 
# skipping the typeChecker step since ts-node(-esm) sometimes breaks on mixed esm import/cjs require between files 
# the current solution is to use the opts.apiJSON + types.{importDir, outputFile} to augen.setRoutes()
#
# rm -rf $CHECKERSRAW
# mkdir $CHECKERSRAW
# CHECKERSRAW_OUTPUT=$(npx ts-node-esm $SCRIPT_DIR/cli.js typeCheckers $ROUTESDIR $IMPORTRELPATH)
# echo "$CHECKERSRAW_OUTPUT" > $CHECKERSRAW/index.ts
# 

npx typia generate --input $CHECKERSRAW --output $CHECKERSDIR # --project ./shared/checkers/tsconfig.json

echo "building documentation at $DOCSDIR ..."
rm -rf $DOCSDIR/*
npx typedoc --json $DOCSDIR/server.json

# assumes `npm run doc` has autogenerated documentation under public/docs/
d3='<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/4.13.0/d3.min.js" integrity="sha512-RJJ1NNC88QhN7dwpCY8rm/6OxI+YdQP48DrLGe/eSAd+n+s1PXwQkkpzzAgoJe4cZFW2GALQoxox61gSY2yQfg==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>' # pragma: allowlist secret
nav="<script src='/docs/nav.js'></script>"
subheader="<div class='docs-subheader'><span class='code-snippet'>./docs/build.sh</span> # to regenerate</div>"
# mv $DOCSDIR/index.html-e $DOCSDIR/index.html
find $DOCSDIR \( -type d -name .git -prune \) -o -type f -print0 | xargs -0 sed -i -e "s|<body>|<body>$d3$nav$subheader|g"
rm -rf $DOCSDIR/**/*.*-e
rm -rf $DOCSDIR/*.*-e
rm -rf $DOCSDIR/**/.*-e
rm -rf $DOCSDIR/.*-e

$SCRIPT_DIR/src/extractTypesFromHtml.js $PWD/$DOCSDIR > $DOCSDIR/extracts.json
npx tsc $CHECKERSDIR/index.ts
# echo "npx webpack --config=$SCRIPT_DIR/webpack.config.cjs --env entry=$PWD/$CHECKERSDIR/index.js --env outdir=$PWD/$DOCSDIR"
npx webpack --config=$SCRIPT_DIR/webpack.config.cjs --env entry=$PWD/$CHECKERSDIR/index.js --env outdir=$PWD/$DOCSDIR
