# Proteinpaint Server

The data server backend for the ProteinPaint application

## Installation

The client dependencies should be installed as a workspace, follow the README at the project root.

You can either:
- use a docker container for development, see ../build/dev/README.md
- or install the [system depedencies](https://docs.google.com/document/d/1tkEHG_vYtT-OifPV-tlPeWQUMsEd3aWAKf5ExOT8G34/edit#heading=h.jy5sdrb1zkut)
as listed in the [installation instructions](https://docs.google.com/document/d/1tkEHG_vYtT-OifPV-tlPeWQUMsEd3aWAKf5ExOT8G34/edit#heading=h.6nxua6c3ik9l).


## Serverconfig

`server/serverconfig.json` is used:
- when running any server or test scripts from the pp/server directory
- if `${process.cwd()/serverconfig.json` does not exist wherever `@sjcrh/proteinpaint-server` is called

If no `test:unit` code uses serverconfig, then it would have been okay to not have `server/serverconfig.json`.
However, it's safer to simply have that file available just in case any imported server code uses serverconfig
and runs as part of test:unit, and that's why `server/emitImports.js` creates one if it doesn't exist by
copying `container/ci/serverconfig.json`.


## Develop

The local development environment is usually triggered following one of these:
- follow the `Develop` section in [proteinpaint/README.md](https://github.com/stjude/proteinpaint/blob/master/README.md) (preferred)
- `npm start` from the `server` dir

## Test

To run both type checks and test:unit: `npm run test`.

To run type check only: `npx tsc`.

To run unit tests only: `npm run test:unit`

To run specific test file: `npx tsx path/to/spec.ts` 


## Build

```bash
npm pack
```

## Release

Use Github Actions to coordinate the release of related package updates.
The package versioning, build, and deployment uses the standard npm tooling under the hood
(`version`, `pack`, and `publish`, respectively).
