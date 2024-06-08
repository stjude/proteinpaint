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
	--watch-path=./termdb \
	--watch-path=./termsetting \
	--watch-path=./tracks \
	--watch-path=./types \
	esbuild.config.js
