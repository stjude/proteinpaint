#!/bin/bash

npx typia generate --input src/checkers --output dist

rm -rf srcjs
mkdir srcjs
npx esbuild src/*.ts --platform=node --outdir=srcjs --format=esm
npx esbuild src/**/*.ts --platform=node --outdir=srcjs --format=esm
grep -lr ".ts\"" srcjs | xargs sed -i.bk -e "s|.ts\"|.js\"|g"
cp package.json srcjs/
sed -i.bk -e "s|.ts\"|.js\"|g" srcjs/package.json
rm -rf srcjs/*.bk  
rm -rf srcjs/**/*.bk
