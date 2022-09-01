# Proteinpaint Server

The frontend code for the ProteinPaint application

## Installation

This should be installed as a workspace, follow the README at the project root.

## Develop

From the proteinpaint/client directory:
```bash
npm run dev # generates bundles to public/bin
npm test # tests the client code
npm run browser # bundles the front-end spec files for use at localhost:[port]/testrun.html
npm run gdc # runs the gdc tests
```

## Test

NOTE: Running `npm test` at the project root will run both client and server tests.

`npm test` to run all available frontend tests.

To run a specific file with a $namepattern (such as filter): `node ./test/import-specs.js name=$namepattern && npm run tape`

## Build

```bash
npm version [major | minor | patch] # TODO: coordinate version changes across dependent workspaces
npm pack
npm publish
# !!! TODO: When deploying, use `npm update` from within the target host machine. !!!
```
