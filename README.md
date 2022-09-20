# Proteinpaint

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
# to install system and application dependencies, then run of the scripts below
```

## Develop

These scripts require npm v7.7.6+ and are tested with Node v16+.
Bundles were also tested to run in Node v12.21+ in a SJ host machine. 

```bash
# develop BOTH server and client code using 2 terminal windows/tabs
npm run dev # rebundles backend and frontend code
npm start # in separate terminal runs the proteinpaint server, requires a serverconfig.json at the project root

# --- OR --- 
# to display both server/client bundling logs, 
# plus server process logs in one terminal window/tab
npm run dev1

# --- OR ---
# see build/dev/README.md to use a Docker container for development
npm run docker
```

When running your dev server, you can see [marked up README's in the browser](http://localhost:3000/readme.html).

## Test
```bash
npm test # tests both frontend and backend code
```

## Build + Deploy

```bash
./build/deploy.sh [env] # builds and deploys the bundled code to internal SJ hosts
# or to deploy to internal/external production servers
npm run ppr
npm run prp1
```

## Package Release

Follow the [build instructions](https://docs.google.com/document/d/13gUdU9UrHFkdspcQgc6ToRZJsrdFM4LCwCg7g1SQc4Q/edit?usp=sharing).

### Use Proteinpaint as a module

Follow the [example project setup](https://github.com/stjude/pp-dist).

