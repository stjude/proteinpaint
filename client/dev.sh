#!/bin/bash

set -euxo pipefail

rm -rf ./dist

if [[ ! -d ../public/bin ]]; then
	mkdir ../public/bin
fi

OUTDIR=$(pwd)/dist
if [[ "${BUNDLE_OUTDIR:-}" != "" ]]; then
	echo "[BUNDLE_OUTDIR=$BUNDLE_OUTDIR]"
	OUTDIR="$BUNDLE_OUTDIR"
fi

ln -sf $OUTDIR ../public/bin/
ln -sf $(pwd)/../front/src/app.js ../public/bin/proteinpaint.js

# needed to track messages for browser notification
if [[ ! -d ../.sse/messages ]]; then
	mkdir -p ../.sse/messages
fi

ENV=dev node --conditions=sjpp/dev esbuild.config.mjs
