# Proteinpaint

a genomics visualization tool for exploring a cohort's genotype and phenotype data


## Usage

Follow the [example project setup](https://github.com/stjude/pp-dist).


## Develop

### Source Code 

```bash
# St. Jude developers
git clone git@github.com:stjude/proteinpaint.git 

# GDC developers
git clone git@github.com:NCI-GDC/proteinpaint.git
```

### Installation

If working on the server code: Install the [system depedencies](https://docs.google.com/document/d/1tkEHG_vYtT-OifPV-tlPeWQUMsEd3aWAKf5ExOT8G34/edit#heading=h.jy5sdrb1zkut) as listed in the [installation instructions](https://docs.google.com/document/d/1tkEHG_vYtT-OifPV-tlPeWQUMsEd3aWAKf5ExOT8G34/edit#heading=h.6nxua6c3ik9l).

```bash
cd proteinpaint
npm run sethooks
# follow the instructions at https://docs.google.com/document/d/1tkEHG_vYtT-OifPV-tlPeWQUMsEd3aWAKf5ExOT8G34/edit
# to install system and application dependencies, then run of the scripts below
```

### Scripts

This requires *npm v7* and tested with Node v12 and v14. Bundles were tested to run in Node v10.15.3 in a SJ host machine. 

#### Project root

```bash
# one-time setup
npm install -g npm@7 # if you have not upgraded yet
npm run emptyws # remove node_modules and lock files in workspaces
npm install # installs workspaces
npm run linkws # create node_modules symlinks in workspaces 

# develop
npm run dev # rebundles backend and frontend code
npm start # runs the proteinpaint server, requires a serverconfig.json at the project root
npm test # tests both frontend and backend code
```
#### in client/
```bash
npm run dev # generates bundles to public/bin
npm test # tests the client code
npm run browser # bundles the front-end spec files for use at localhost:[port]/testrun.html
npm run gdc # runs the gdc tests
```

#### in server/
```bash
npm run dev # generates the server.js bundle
npm start` # starts the server
npm test # tests the server conde
```

#### in targets/sj/
```bash
cd targets/sj
./deploy.sh [env] # builds and deploys the bundled code to internal SJ hosts

# or to deploy to ppr
npm run ppr
```

## Build

Follow the [build instructions](https://docs.google.com/document/d/13gUdU9UrHFkdspcQgc6ToRZJsrdFM4LCwCg7g1SQc4Q/edit?usp=sharing).
