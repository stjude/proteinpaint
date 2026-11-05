#!/bin/bash

# Builds the wasm modules of the binaries in Cargo.toml, and copies them to OUTDIR, which is rust/target/wasm by
# default, where run_rust() in ../index.js finds them. The cargo build output is in CARGO_TARGET_DIR, which is
# rust/target/wasm-build by default, so that OUTDIR has only the modules.
#
# It needs clang, llvm-ar, a WASI libc and the wasm32-wasip1 rust target, such as on Debian trixie:
#
#   apt-get install clang llvm wasi-libc && rustup target add wasm32-wasip1
#
# or else use ../buildWasm.sh, which runs this script in a container.
#
# Usage, from any dir: ./rust/wasm/build.sh [OUTDIR]

set -euo pipefail

WASMDIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
OUTDIR=${1:-$WASMDIR/../target/wasm}
[[ "$OUTDIR" = /* ]] || OUTDIR="$PWD/$OUTDIR"
export CARGO_TARGET_DIR=${CARGO_TARGET_DIR:-$WASMDIR/../target/wasm-build}

cd "$WASMDIR"
# -fvisibility=default, since clang hides the functions of a wasm target by default, which bindgen then skips; the
# macOS ar writes an archive index that the wasm linker cannot read, so llvm-ar is used, such as from `brew install llvm`
AR_wasm32_wasip1=${AR_wasm32_wasip1:-llvm-ar} CC_wasm32_wasip1=${CC_wasm32_wasip1:-clang} \
	BINDGEN_EXTRA_CLANG_ARGS_wasm32_wasip1=${BINDGEN_EXTRA_CLANG_ARGS_wasm32_wasip1:-"--target=wasm32-wasip1 --sysroot=/usr -fvisibility=default"} \
	cargo build --locked --release --target wasm32-wasip1

# each binary in Cargo.toml has a module, so that a missing one is not found only when the server spawns its binary
mkdir -p "$OUTDIR"
missing=""
for bin in $(awk '/^\[\[bin\]\]/{b=1; next} /^\[/{b=0} b && /^name *=/{gsub(/^name *= *"|".*$/, ""); print}' Cargo.toml); do
	if [[ -f "$CARGO_TARGET_DIR/wasm32-wasip1/release/$bin.wasm" ]]; then
		cp "$CARGO_TARGET_DIR/wasm32-wasip1/release/$bin.wasm" "$OUTDIR/"
	else
		missing="$missing $bin"
	fi
done
if [[ "$missing" != "" ]]; then
	echo "ERROR: no wasm module for:$missing" >&2
	exit 1
fi
ls "$OUTDIR"/*.wasm
