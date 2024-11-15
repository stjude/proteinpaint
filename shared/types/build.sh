#!/bin/bash

set -euxo pipefail

npx tsx emitCheckers.ts 
npx typia generate --input ./checkers --output ./dist
node esbuild.config.mjs
