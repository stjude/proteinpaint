#!/bin/bash

cd server/utils/rust
cargo build --release
rm -rf src Cargo.*
# keep these for dynamically linked deps?
# rm -rf target/release/deps target/release/build
