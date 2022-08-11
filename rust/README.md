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

## Build

```bash
npm build # cargo build --release
```

The compiled dependencies and target binaries will be generated under `./target/release`.

## Using from nodejs

```js
// assuming a js file from server/src 
const run_rust = require('@stjude/proteinpaint-rust').run_rust
// or 
// import * as utils from './utils'

// 'indel' may be replaced by any binary name as specified in Cargo.toml
const out = await run_rust('indel', input_data)
```

## Test

From the `proteinpaint/server` directory,
```bash
npx test
```
