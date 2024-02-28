# ProteinPaint

a genomics visualization tool for exploring a cohort's genotype and phenotype data

## Source Code 

```bash
git clone git@github.com:stjude/proteinpaint.git
```

## Installation

If working on the server code: Install the 
[system depedencies](https://docs.google.com/document/d/1tkEHG_vYtT-OifPV-tlPeWQUMsEd3aWAKf5ExOT8G34/edit#heading=h.jy5sdrb1zkut)
as listed in the [installation instructions](https://docs.google.com/document/d/1tkEHG_vYtT-OifPV-tlPeWQUMsEd3aWAKf5ExOT8G34/edit#heading=h.6nxua6c3ik9l).

```bash
cd proteinpaint
npm run sethooks
nvm use 20
npm install
# follow the instructions at https://docs.google.com/document/d/1tkEHG_vYtT-OifPV-tlPeWQUMsEd3aWAKf5ExOT8G34/edit
```

## Develop

These scripts require npm v7.7.6+ and are tested with Node v16+.
Bundles were also tested to run in Node v12.21+ in a SJ host machine. 

```bash
# develop BOTH server and client code using 2 terminal windows/tabs
npm run dev # rebundles backend and frontend code
npm start # in separate terminal runs the ProteinPaint server, requires a serverconfig.json at the project root

# --- OR --- 
# to display both server/client bundling logs, 
# plus server process logs in one terminal window/tab
npm run dev1

# --- OR ---
# see build/dev/README.md to use a Docker container for development
```

When running your dev server, you can see [marked up README's in the browser](http://localhost:3000/readme.html).

## Test
```bash
npm testws # tests all workspaces
```

You can also set your `serverconfig.debugmode: true`, and open http://localhost:3000/testrun.html to see available client-side unit and integration tests.

## Build

### Package Release

The build and release steps can be triggered via Github Actions using the Create Release workflow.

### Docker Build

See [container/README.md](https://github.com/stjude/proteinpaint/blob/master/container/README.md).

### Version 

Use Github Actions to coordinate the release of related package updates.
The package versioning, build, and deployment uses the standard npm tooling under the hood
(`version`, `pack`, and `publish`, respectively).

You may dry-run a version change by running the following:

```bash
cd ~/proteinpaint
# see the comments in the script for arguments
./build/jump.sh patch

# to undo changes if the `-w` option was used 
git restore .
```

## Document

To auto-generate documentation to public/docs,

```bash
npm run doc
```

TODOs: 
- Organize the leftbar links by API topics, by using typescript namespaces or coding a custom plugin
- Display test code that are specific to a documented type or interface
