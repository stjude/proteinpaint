#!/bin/bash

# Builds the rust wasm modules of wasm/Cargo.toml in a container, so that no wasm toolchain, such as llvm-ar and a WASI
# libc, is needed on the host. The modules are written to target/wasm/wasm32-wasip1/release, where run_rust() in
# index.js finds them, such as for a dev server that is started with USE_WASM=1. A wasm module does not depend on the
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
#   compile the crates again; the target dir is not ../target/wasm, so that it is not mixed with a host build
# - only the modules are copied to target/wasm, and given to the host user, since the container runs as root
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
		# -fvisibility=default, since clang hides the functions of a wasm target by default, which bindgen then skips
		AR_wasm32_wasip1=llvm-ar CC_wasm32_wasip1=clang \
		BINDGEN_EXTRA_CLANG_ARGS_wasm32_wasip1="--target=wasm32-wasip1 --sysroot=/usr -fvisibility=default" \
			cargo build --locked --release --target wasm32-wasip1 --target-dir /build/target
		out=../target/wasm/wasm32-wasip1/release
		mkdir -p $out
		cp /build/target/wasm32-wasip1/release/*.wasm $out/
		chown -R "$HOST_UID:$HOST_GID" ../target/wasm'

ls "$RUSTDIR/target/wasm/wasm32-wasip1/release/"*.wasm
