#!/bin/bash

# Builds the rust wasm modules of wasm/Cargo.toml in a container, so that no wasm toolchain, such as llvm-ar and a WASI
# libc, is needed on the host. wasm/build.sh writes the modules to target/wasm, where run_rust() in index.js finds them,
# and then runs a module instead of spawning its binary. A wasm module does not depend on the
# platform that builds it.
#
# Usage, from any dir: ./rust/buildWasm.sh
#
# EXTRA_CA_CERTS, or else NODE_EXTRA_CA_CERTS, may be the path of a PEM file with a local CA, such as for a
# TLS-inspecting gateway, which the container then trusts for its rustup and crate downloads.

set -euo pipefail

RUSTDIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# the toolchain version in rust-toolchain.toml
RUST_IMAGE=${RUST_IMAGE:-rust:1.91.0-slim-trixie@sha256:d9ba8014603166915f7e0fcaa9af09df2a1fc30547e75a72c1d34165139f036a}

CA_OPTS=()
CA_FILE=${EXTRA_CA_CERTS:-${NODE_EXTRA_CA_CERTS:-}}
if [[ "$CA_FILE" != "" ]]; then
	CA_OPTS=(--mount "type=bind,source=$(cd "$(dirname "$CA_FILE")" && pwd)/$(basename "$CA_FILE"),target=/extra_ca_certs.pem,readonly")
fi

# - the crate registry and the cargo target dir are kept in named volumes, so that a rebuild does not download or
#   compile the crates again, and it is not target/wasm-build, so that it is not mixed with a host build
# - wasm/build.sh copies only the modules to target/wasm, which are given to the host user, since the container runs
#   as root
docker run --rm \
	--mount "type=bind,source=$RUSTDIR,target=/build/rust" \
	--mount "type=volume,source=pp-rust-wasm-registry,target=/usr/local/cargo/registry" \
	--mount "type=volume,source=pp-rust-wasm-target,target=/build/target" \
	--workdir /build/rust/wasm \
	-e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
	${CA_OPTS[@]+"${CA_OPTS[@]}"} \
	"$RUST_IMAGE" \
	bash -c 'set -euo pipefail
		apt-get update -qq && apt-get install -y -qq --no-install-recommends ca-certificates clang llvm wasi-libc > /dev/null
		if [[ -f /extra_ca_certs.pem ]]; then
			cp /extra_ca_certs.pem /usr/local/share/ca-certificates/extra_ca_certs.crt && update-ca-certificates > /dev/null
		fi
		rustup target add wasm32-wasip1
		CARGO_TARGET_DIR=/build/target ./build.sh > /dev/null
		chown -R "$HOST_UID:$HOST_GID" ../target/wasm'

ls "$RUSTDIR/target/wasm/"*.wasm
