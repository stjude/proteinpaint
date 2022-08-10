#!/bin/bash

cd rust
cargo build --release
rm -rf src Cargo.*
# keep these for dynamically linked deps?
# rm -rf target/release/deps target/release/build
