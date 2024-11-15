#!/bin/bash

set -e

# npx typia generate --input src/checkers --output dist

rm -rf dist
mkdir dist
node esbuild.config.js 

# rm -rf srcjs
# cp -r src srcjs
# # emit js file from routes ts files, to allow parsing of exported payload object 
# npx esbuild srcjs/routes/*.ts --platform=node --outdir=srcjs/routes --format=esm
# node emitCheckers.js
# rm srcjs/routes/*.js
# npx typia generate --input srcjs/routes --output dist/routes
# rm -rf srcjs/routes
# mv dist/routes srcjs/

# npx esbuild srcjs/*.ts --platform=node --outdir=dist --format=esm
# npx esbuild srcjs/**/*.ts --platform=node --outdir=dist --format=esm
# grep -lr ".ts\"" srcjs | xargs sed -i.bk -e "s|.ts\"|.js\"|g"
# cp package.json srcjs/
# sed -i.bk -e "s|.ts\"|.js\"|g" srcjs/package.json
# rm -rf srcjs/*.bk
# rm -rf srcjs/**/*.bk
