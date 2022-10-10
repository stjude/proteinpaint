# Proteinpaint Client

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

Use the helper scripts to coordinate the version changes across related workspaces.

### Dry-Run 

You can dry-run a version change by supplying 3 arguments to the version helper script,
for example:  

```bash
cd ~/proteinpaint
./build/version.sh prerelease pp-prt dry dry

# should show the expected version changes at the end of the output
> ...
> SKIPPED commit, tag, and publish in dry-run mode: 
> v2.4.2-0  server-2.4.1-30 client-2.4.1-30 front-2.4.1-30 pp-prt:^server pp-prt:^front
```

It is NOT RECOMMENDED to trigger `npm version` separately on each workspace, as it is
easy to miss required dependency version changes downstream of a changed workspace.

### Deploy

It is RECOMMENDED to use the deploy helper script to trigger the version change, so
that only deployed changes are versioned. Otherwise, the commit history can get noisy
with too many version commits and tags.

```bash
cd ~/proteinpaint
./sj/deploy.sh 
npm version [TYPE]
npm pack
npm publish
```
