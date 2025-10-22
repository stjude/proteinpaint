#!/bin/bash

set -euxo pipefail

#
# glob string pattern for matching filenames to test
# usually *.unit.spec.* or *.unit.integration.spec.* which bundles all matching spec files,
# or more rarely, use specific strings such as `tvs.unit.spec.*` to avoid bundling
# code that are not related to the component that is being tested. However, esbuild bundles so
# fast and error traces are usually easy to follow, that bundling unrelated spec files together
# just works without leading to slow tests or hard to follow logic for flaky tests.
#
SPECPATTERN=$1 # will be used to emit imports

# 
# space separated URL params to be used to filter which bundled spec file to run, examples: 
# - "name=tvs.unit.spec"
# - "dir=filter"
# - or use the URL parameter after clicking on a card dir/file name in http://localhost:3000/testrun.html
#
PATTERNSLIST="" # 
if (($# > 1)); then
	PATTERNSLIST=$2
fi
TESTPORT=3000
if (($# > 2)); then
 TESTPORT=$3
fi

TESTHOST=http://localhost:$TESTPORT
# if [[ "$SPECPATTERN" != *".unit."* && "$TESTPORT" != "6789" ]]; then
# 	./test/pretest.js $TESTHOST
# fi

if [[ ! -f "./test/tape.bundle.js" ]]; then
	# NOTES:
  # - webpack bundling is still needed in github CI, but not for local dev/test spec bundles
	# - assume that the tape lib rarely changes in local testing environment;
	#   this does not affect the CI environment, where the runner will install
	#   from a freshly cloned repo and will always have to create the tape.bundle
	#
	# TODO: 
	# - use a good esbuild node polyfill plugin to avoid having to use webpack,
	#   to bundle and supply tape lib with missing node libs
	npx webpack --config=./webpack.tape.config.mjs
fi

# create soft links in public dir to client coverage report 
# ln -sfn $PWD/.coverage ../public/coverage/client

# re-emit spec file imports
rm -rf ../public/bin/test
TESTFILE=test/internals-test.js
node emitImports.mjs $SPECPATTERN > ./$TESTFILE

ENV=test node esbuild.config.mjs

# puppeteer needs headless chrome, install as needed
set +u # disable unbound variable check
if [[ "$PUPPETEER_SKIP_DOWNLOAD" != "" ]]; then
	NODE_TLS_REJECT_UNAUTHORIZED=0 npx puppeteer browsers install chrome
fi
set -u # reenable unbound variable check

# rm -rf .coverage
node test/puppet.js "$PATTERNSLIST" "$TESTPORT"

# if [[ -d .coverage && -f .coverage/coverage-summary.json ]]; then
#   cp .coverage/coverage-summary.json branch_coverage.json
# fi
