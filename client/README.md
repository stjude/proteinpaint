# Proteinpaint Client

The client code for the ProteinPaint application

## Installation/Usage

NOTE: The usage below is meant for data portals that prefer to bundle proteinpaint
client code directly, instead of relying on a `runproteinpaint()` global that is
exposed using `<script src='<proteinpaint_domain>/bin/proteinpaint.js'>`.

```
npm install @sjcrh/proteinpaint-client
```
Then
```js
import { runproteinpaint } from '@sjcrh/proteinpaint-client'

runproteinpaint({
  // arguments, see https://github.com/stjude/proteinpaint/wiki/Embedding
})
```

## Develop

This should be installed as a workspace, follow the README at the [proteinpaint]() project root.

From the proteinpaint/client directory:
```bash
npm run dev # generates bundles to public/bin
# the client dev script is usually called together with server start
# for St. Jude developers, that's `npm run dev` from the supermodule/parent repo
```

## Test

You can view and run tests from `http://localhost:3000`, if you have a full dev environment running.

```bash

npm run test:unit
npm run test:integration

./test.sh *tvs.*.spec.*

# not recommended: `npm test` to run all available client-side tests.

## Build

```bash
npm pack
```

## Release

Use Github Actions to coordinate the release of related package updates.
The package versioning, build, and deployment uses the standard npm tooling under the hood
(`version`, `pack`, and `publish`, respectively).
