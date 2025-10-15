# Rust-compiled utilities

This directory holds the source code for rust-compiled utilities.


## Rust version

Current rust version is 1.89.0. TODO introduce `rust-toolchain` file, and pin the rust version there.

Currently the version is hardcoded in:

the Github Actions workflow file `.github/workflows/CD-rust-build.yml`.

The Github Actions workflow file `.github/workflows/CI-unit.yml`.

The rust build docker file `container/rust/Dockerfile`.

When bumping the rust version, please update these files accordingly, and publish the new rust build env image using:

https://github.com/stjude/proteinpaint/actions/workflows/CD-publish-rust-bookworm-env-image.yml

## Code layout

All source code files should be directly under the `src/` directory. For a source
code file to be compiled, create a `[[bin]]` entry for it in the Cargo.toml file:

```toml
[[bin]]
name="tool0"
path="src/tool0.rs"

[[bin]]
name="othertool1"
path="src/othertool1.rs"
```

Note that the default package.autobins has been disabled, so that we avoid using
the src/bin subdirectory to hold uncompiled source code files. The convention in
the Proteinpaint project is to put bundled or compiled code under a `bin/` folder,
which goes against rust cargo's assumptions of having source code under `src/bin`.

## Using from nodejs

```js
// Assuming a js or ts file from server/src 

import { run_rust } from '@sjcrh/proteinpaint-rust'


// 'indel' may be replaced by any binary name as specified in Cargo.toml
const out = await run_rust('indel', input_data)
```

## Test

For running the tests written in nodejs, from the `proteinpaint` directory run,

```bash
npm run test:unit --workspace="rust"
```

For running the tests written in native rust, from the `proteinpaint/rust` directory run.
```bash
cargo test
```

For running AI tests using cargo, they need to be run locally since CI does not have access to the LLM server. These tests are "ignored" in CI and need the `ignored` flag to be run. These tests must be run from the `proteinpaint/rust` directory. 3 tests wil be run using the command below. One each to see if the SJ and ollama server are accessible and the third one is unit test for the actual ai chatbot. 

```bash
time cargo test -- --ignored --nocapture
```

## Build

```bash
npm run build # cargo build --release
```

The compiled dependencies and target binaries will be generated under `./target/release`.

## Release

Use Github Actions to coordinate the release of related package updates.
The package versioning, build, and deployment uses the standard npm tooling under the hood
(`version`, `pack`, and `publish`, respectively).
