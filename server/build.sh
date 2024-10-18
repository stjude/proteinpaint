#!/bin/bash

set -euxo pipefail

# generate js versions of ts files
DIR=genome npm run mjs
DIR=dataset npm run mjs
DIR=routes npm run mjs

npx esbuild src/app.ts --bundle --platform=node --packages=external --format=esm --sourcemap > src/app.js
# npx esbuild src/checkReadingFrame --outdir=dist/cjs --bundle --platform=node --packages=external --format=cjs

sed -i.bk 's|clinvar.ts|clinvar.js|g' dataset/clinvar.hg19.js
sed -i.bk 's|clinvar.ts|clinvar.js|g' dataset/clinvar.hg38.js

# Non-critical cleanup step, allow it to fail silently
rm -f dataset/*.bk
