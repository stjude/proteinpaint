#!/bin/bash

rm -rf ./dist

ln -sf $(pwd)/dist ./../public/bin/

node esbuild.config.mjs
