#!/bin/bash

rm -rf ./dist

node esbuild.config.mjs
