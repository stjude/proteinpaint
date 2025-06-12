# Rust-compiled utilities

This directory holds the source code for rust-compiled utilities.

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


## Build

```bash
npm run build # cargo build --release
```

The compiled dependencies and target binaries will be generated under `./target/release`.

## Release

Use Github Actions to coordinate the release of related package updates.
The package versioning, build, and deployment uses the standard npm tooling under the hood
(`version`, `pack`, and `publish`, respectively).
