# ProteinPaint

a genomics visualization tool for exploring a cohort's genotype and phenotype data

## Source Code 

```bash
# St. Jude developers
git clone git@github.com:stjude/proteinpaint.git 

# GDC developers
git clone git@github.com:NCI-GDC/proteinpaint.git
```

## Installation

If working on the server code: Install the 
[system depedencies](https://docs.google.com/document/d/1tkEHG_vYtT-OifPV-tlPeWQUMsEd3aWAKf5ExOT8G34/edit#heading=h.jy5sdrb1zkut)
as listed in the [installation instructions](https://docs.google.com/document/d/1tkEHG_vYtT-OifPV-tlPeWQUMsEd3aWAKf5ExOT8G34/edit#heading=h.6nxua6c3ik9l).

```bash
cd proteinpaint
npm run sethooks
nvm use 16
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
npm test # tests both frontend and backend code
```

## Build

### Package Release

The build and release steps can be triggered via Github Actions using the Create Release workflow.

### Docker Build

See [container/README.md](https://github.com/stjude/proteinpaint/blob/master/container/README.md).

### Version 

Use Github Actions to coordinate the release of related package updates.
The package versioning, build, and deployment uses the standard npm tooling under the hood
(`version`, `pack`, and `publish`, respectively).

You may dry-run a version change by supplying 3 arguments to the version helper script,
for example:  

```bash
cd ~/proteinpaint
./build/version.sh prerelease dry

# should show the expected version changes at the end of the output
> ...
> SKIPPED commit, tag, and publish in dry-run mode: 
> v2.4.2-0  server-2.4.1-30 client-2.4.1-30 front-2.4.1-30 pp-prt:^server pp-prt:^front
```

To undo the dry-run changes, 
```bash
git restore .
```

