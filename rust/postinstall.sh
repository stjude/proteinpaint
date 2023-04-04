#!/bin/bash

# PLATFORM="$( uname )_$( uname -m )"

# CURRDIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# TODO: enable detecting prebuilt binaries by platform
# if [[ ! -d "$CURRDIR/node_modules/@sjcrh/proteinpaint-rust/$PLATFORM" ]]; then 
# 	cargo build --release --target-dir $PLATFORM; 
# fi

if [[ ! -d ./target && ! -d ./test ]]; then
	cargo build --release
fi
