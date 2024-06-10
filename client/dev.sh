#!/bin/bash

node \
	--watch-path=./appdrawer \
	--watch-path=./common \
	--watch-path=./dom \
	--watch-path=./filter \
	--watch-path=./gdc \
	--watch-path=./mass \
	--watch-path=./mds3 \
	--watch-path=./plots \
	--watch-path=./rx \
	--watch-path=./src \
	--watch-path=./termdb \
	--watch-path=./termsetting \
	--watch-path=./tracks \
	--watch-path=./types \
	--watch-path=./package.json \
	--watch-path=./test/matchSpecs.js \
	--watch-path=./emitImports.mjs \
	esbuild.config.cjs
