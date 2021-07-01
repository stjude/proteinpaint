#!/bin/bash
node -v
cp targets/gdc/client/package.json client/
npm run emptyws
cd client/
npx cross-env ELECTRON_GET_USE_PROXY=true GLOBAL_AGENT_HTTPS_PROXY=http://cloud-proxy:3128 npm -D install
npx rollup -c ./rollup.config.js
npm_config__auth=$JENKINS_NPM_AUTHTOKEN npm publish --registry=$REGISTRY
